import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertProjectAccess } from '@/lib/permissions/projectAccess';
import { logAudit } from '@/lib/audit/log';
import { getDropboxClient } from '@/lib/dropbox/client';
import { freePath } from '@/lib/design/dropboxDirect';
import { relativeTo, resolveInside, safeSegment } from '@/lib/sales/designPaths';
import { syncProjectDropbox } from '@/lib/dropbox/autoSync';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Params = { params: Promise<{ id: string }> };

// The project "Files" tab: the project's whole Dropbox folder, read live — every sub-folder and
// file type, as if it were on the site. Uploads and new folders go straight to Dropbox; changes
// made in Dropbox reach the open tab through the webhook (lib/dropbox/autoSync → broadcast).
// Every path is relative to the project's dropbox_root_path and checked by resolveInside.
// Never deletes, moves, renames or overwrites in Dropbox (docs/AGENTS.md §4): uploads use mode
// "add" with a free name.

interface FileEntry { name: string; path: string; tag: 'file' | 'folder'; size: number | null; modified: string | null }

function dropboxError(e: unknown): string {
  const err = e as any;
  return err?.error?.error_summary ?? (e instanceof Error ? e.message : 'Dropbox error');
}

async function projectRoot(id: string): Promise<{ root: string | null; deny: NextResponse | null; userId: string | null; admin: any }> {
  const { user, unauth } = await requireUser();
  const admin = createAdminClient() as any;
  if (!user) return { root: null, deny: unauth as NextResponse, userId: null, admin };
  const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const denied = await assertProjectAccess(id, user.id, (prof as { role?: string } | null)?.role ?? null);
  if (denied) return { root: null, deny: denied, userId: user.id, admin };
  const { data: proj } = await admin.from('projects').select('dropbox_root_path').eq('id', id).single();
  const root = (proj as { dropbox_root_path?: string | null } | null)?.dropbox_root_path?.replace(/\/+$/, '') ?? null;
  if (!root) return { root: null, deny: NextResponse.json({ error: 'This project has no Dropbox folder yet' }, { status: 409 }), userId: user.id, admin };
  return { root, deny: null, userId: user.id, admin };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { root, deny } = await projectRoot(id);
  if (deny) return deny;
  const rel = req.nextUrl.searchParams.get('path') ?? '';
  const abs = resolveInside(root!, rel);
  if (!abs) return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });

  try {
    const dbx = getDropboxClient();
    let res = await dbx.filesListFolder({ path: abs, include_deleted: false });
    const raw: any[] = [...res.result.entries];
    for (let page = 0; res.result.has_more && page < 20; page++) {
      res = await dbx.filesListFolderContinue({ cursor: res.result.cursor });
      raw.push(...res.result.entries);
    }
    const entries: FileEntry[] = raw
      .filter(e => e['.tag'] === 'file' || e['.tag'] === 'folder')
      .map(e => ({
        name: e.name, tag: e['.tag'], path: relativeTo(root!, e.path_display) ?? e.name,
        size: e['.tag'] === 'file' ? e.size ?? null : null,
        modified: e['.tag'] === 'file' ? e.server_modified ?? null : null,
      }))
      .sort((a, b) => (a.tag === b.tag ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.tag === 'folder' ? -1 : 1));
    return NextResponse.json({ root, path: relativeTo(root!, abs) ?? '', exists: true, entries });
  } catch (e) {
    const msg = dropboxError(e);
    if (msg.includes('not_found')) return NextResponse.json({ root, path: rel, exists: false, entries: [] });
    console.error('[project files GET]', msg);
    return NextResponse.json({ error: `Dropbox: ${msg}` }, { status: 502 });
  }
}

// { action: 'upload-link', path, fileName }  one-shot Dropbox upload link into `path` (any size)
// { action: 'uploaded', path }               the browser finished an upload — audit + document sync
// { action: 'mkdir', path, name }            new sub-folder
// { action: 'open', path }                   temporary link to view / download a file
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { root, deny, userId, admin } = await projectRoot(id);
  if (deny) return deny;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? '');
  const dbx = getDropboxClient();

  try {
    if (action === 'upload-link') {
      const dir = resolveInside(root!, String(body.path ?? ''));
      const name = safeSegment(String(body.fileName ?? ''), '');
      if (!dir || !name) return NextResponse.json({ error: 'Invalid folder or file name' }, { status: 400 });
      const target = await freePath(dir, name); // never overwrite: a free name up front
      const res = await dbx.filesGetTemporaryUploadLink({
        commit_info: { path: target, mode: { '.tag': 'add' }, autorename: true },
        duration: 3600,
      });
      return NextResponse.json({ link: res.result.link, path: relativeTo(root!, target) ?? name });
    }

    if (action === 'uploaded') {
      const abs = resolveInside(root!, String(body.path ?? ''));
      if (!abs || abs === root) return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
      const meta = await dbx.filesGetMetadata({ path: abs });
      if (meta.result['.tag'] !== 'file') return NextResponse.json({ error: 'Not a file' }, { status: 400 });
      const rel = relativeTo(root!, abs) ?? meta.result.name;
      await logAudit({ actorId: userId, action: 'project.file_uploaded', projectId: id, resource: rel, newValue: { path: rel, size: meta.result.size } });
      // A PDF in a version folder becomes a document right away (the webhook would too, a moment later).
      const synced = rel.toLowerCase().endsWith('.pdf') ? (await syncProjectDropbox(admin, dbx, id, userId)).synced : 0;
      return NextResponse.json({ ok: true, synced });
    }

    if (action === 'mkdir') {
      const dir = resolveInside(root!, String(body.path ?? ''));
      const name = safeSegment(String(body.name ?? ''), '');
      if (!dir || !name) return NextResponse.json({ error: 'Invalid folder name' }, { status: 400 });
      await dbx.filesCreateFolderV2({ path: `${dir}/${name}`, autorename: false });
      await logAudit({ actorId: userId, action: 'project.folder_created', projectId: id, resource: relativeTo(root!, `${dir}/${name}`) ?? name });
      return NextResponse.json({ ok: true });
    }

    if (action === 'open') {
      const abs = resolveInside(root!, String(body.path ?? ''));
      if (!abs || abs === root) return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
      const res = await dbx.filesGetTemporaryLink({ path: abs });
      return NextResponse.json({ link: res.result.link });
    }
  } catch (e) {
    const msg = dropboxError(e);
    console.error(`[project files ${action}]`, msg);
    return NextResponse.json({ error: msg.includes('conflict') ? 'A folder with that name already exists' : `Dropbox: ${msg}` }, { status: msg.includes('conflict') ? 409 : 502 });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
