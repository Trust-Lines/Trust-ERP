import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createRawAdminClient } from '@/lib/supabase/admin';
import { roleCan } from '@/lib/permissions/server';
import { logAudit } from '@/lib/audit/log';
import { getDropboxClient } from '@/lib/dropbox/client';
import { dropboxErrorInfo, dropboxErrorMessage } from '@/lib/dropbox/errors';
import { matchProject, type MatchProject } from '@/lib/dropbox/match';
import { projectFolders, resetScan, scanStatus, scanStep } from '@/lib/dropbox/folderScan';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Admin "Dropbox Matching": scan the connected Dropbox's folder tree, score each project against
// it, and let a person link the right folder. Linking changes only projects.dropbox_root_path
// (+ audit) — nothing in Dropbox is created, moved or renamed here.
export const maxDuration = 300;
const PERM = 'page.dropbox_wizard';

async function guard() {
  const { user, unauth } = await requireUser();
  if (!user) return { user: null, admin: null, deny: unauth as NextResponse };
  const admin = createRawAdminClient() as any;
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (!(await roleCan(admin, (data as { role?: string } | null)?.role, PERM))) {
    return { user: null, admin: null, deny: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user, admin, deny: null };
}

const missingTable = (m?: string) => !!m && /dropbox_folder_index|dropbox_project_links|schema cache|does not exist/i.test(m);

export async function GET() {
  const { admin, deny } = await guard();
  if (deny) return deny;
  try {
    const dbx = getDropboxClient();
    const [acct, status, folders, projRes, linkRes] = await Promise.all([
      dbx.usersGetCurrentAccount().then(r => r.result).catch(() => null),
      scanStatus(admin),
      projectFolders(admin),
      admin.from('projects').select('id, code, name, region, service_line, current_stage, dropbox_root_path').is('deleted_at', null).order('code'),
      admin.from('dropbox_project_links').select('project_id, status, path, decided_at, decided_by'),
    ]);
    if (linkRes.error && missingTable(linkRes.error.message)) {
      return NextResponse.json({ error: 'Run migration 149_dropbox_folder_index.sql first.' }, { status: 503 });
    }
    const projects = (projRes.data ?? []) as MatchProject[];
    // Stored paths that are real folders in the index (project-like or not).
    const stored = [...new Set(projects.map(p => p.dropbox_root_path?.toLowerCase().replace(/\/+$/, '')).filter(Boolean))] as string[];
    const existing = new Set<string>();
    for (let i = 0; i < stored.length; i += 100) {
      const { data } = await admin.from('dropbox_folder_index').select('path_lower').in('path_lower', stored.slice(i, i + 100));
      for (const r of data ?? []) existing.add(r.path_lower);
    }
    const links = new Map(((linkRes.data ?? []) as { project_id: string }[]).map(l => [l.project_id, l]));
    const rows = projects.map(p => ({
      project: { id: p.id, code: p.code, name: p.name, path: p.dropbox_root_path },
      link: links.get(p.id) ?? null,
      ...(status.folders ? matchProject(p, folders, existing) : { status: 'none', candidates: [] }),
    }));
    return NextResponse.json({
      account: acct ? { name: acct.name?.display_name, email: acct.email, team: (acct as any).team?.name ?? null } : null,
      scan: status, rows,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (missingTable(msg)) return NextResponse.json({ error: 'Run migration 149_dropbox_folder_index.sql first.' }, { status: 503 });
    return NextResponse.json({ error: dropboxErrorMessage(e) }, { status: 502 });
  }
}

// { action: 'scan' }                        list the next slice of folders (call until done)
// { action: 'rescan' }                      forget the index and start over
// { action: 'link', projectId, path }       this folder is the project's (checked in Dropbox first)
// { action: 'confirm', projectId }          the stored folder is right
// { action: 'no_folder', projectId, note? } the project has no folder on this drive
// { action: 'undo', projectId }             forget the decision (the stored path stays)
export async function POST(req: NextRequest) {
  const { user, admin, deny } = await guard();
  if (deny) return deny;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? '');
  const projectId = typeof body.projectId === 'string' ? body.projectId : '';
  const dbx = getDropboxClient();

  try {
    if (action === 'scan') return NextResponse.json(await scanStep(admin, dbx));
    if (action === 'rescan') { await resetScan(admin, dbx); return NextResponse.json(await scanStatus(admin)); }

    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    const { data: proj } = await admin.from('projects').select('id, code, dropbox_root_path').eq('id', projectId).is('deleted_at', null).single();
    if (!proj) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const decide = (status: 'confirmed' | 'no_folder', path: string | null, note?: string) =>
      admin.from('dropbox_project_links').upsert({ project_id: projectId, status, path, decided_by: user!.id, decided_at: new Date().toISOString(), note: note ?? null });

    if (action === 'link') {
      const path = String(body.path ?? '').trim().replace(/\/+$/, '');
      if (!path.startsWith('/')) return NextResponse.json({ error: 'A Dropbox path starts with /' }, { status: 400 });
      let real: string;
      try {
        const meta = await dbx.filesGetMetadata({ path });
        if (meta.result['.tag'] !== 'folder') return NextResponse.json({ error: 'That path is a file, not a folder' }, { status: 400 });
        real = meta.result.path_display ?? path;
      } catch (e) {
        if (dropboxErrorInfo(e).notFound) return NextResponse.json({ error: 'No such folder in Dropbox' }, { status: 404 });
        throw e;
      }
      const { error } = await admin.from('projects').update({ dropbox_root_path: real }).eq('id', projectId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await decide('confirmed', real);
      await logAudit({ actorId: user!.id, action: 'project.dropbox_relinked', projectId, resource: proj.code, oldValue: { path: proj.dropbox_root_path }, newValue: { path: real } });
      return NextResponse.json({ ok: true, path: real });
    }

    if (action === 'confirm') {
      if (!proj.dropbox_root_path) return NextResponse.json({ error: 'No stored folder to confirm' }, { status: 400 });
      await decide('confirmed', proj.dropbox_root_path);
      await logAudit({ actorId: user!.id, action: 'project.dropbox_confirmed', projectId, resource: proj.code, newValue: { path: proj.dropbox_root_path } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'no_folder') {
      await decide('no_folder', null, typeof body.note === 'string' ? body.note.slice(0, 300) : undefined);
      await logAudit({ actorId: user!.id, action: 'project.dropbox_no_folder', projectId, resource: proj.code });
      return NextResponse.json({ ok: true });
    }

    if (action === 'undo') {
      await admin.from('dropbox_project_links').delete().eq('project_id', projectId);
      return NextResponse.json({ ok: true });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (missingTable(msg)) return NextResponse.json({ error: 'Run migration 149_dropbox_folder_index.sql first.' }, { status: 503 });
    console.error('[dropbox-matching]', action, msg);
    return NextResponse.json({ error: dropboxErrorMessage(e) }, { status: 502 });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
