import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { logLeadActivity } from '@/lib/sales/activity';
import { requireUserWithRole, loadDesignJobWithAccess } from '@/lib/sales/design';
import { ensureSharedLink, resolveDesignFolder } from '@/lib/sales/designFolder';
import { DESIGN_VERSION_BASE, DESIGN_VERSION_SUBFOLDERS, nextVersionNo, relativeTo, resolveInside, safeSegment } from '@/lib/sales/designPaths';

type Params = { params: Promise<{ jobId: string }> };

// The Design workspace "Files" tab: browse the job's Dropbox design folder, upload straight into
// the right sub-folder, open files, share the folder with Sales. Every path is relative to the
// job's own folder and checked by resolveInside — nothing outside it can be read or written.

interface Entry { name: string; path: string; tag: 'file' | 'folder'; size: number | null; modified: string | null }

function dropboxError(e: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const err = e as any;
  return err?.error?.error_summary ?? (e instanceof Error ? e.message : 'Dropbox error');
}

export async function GET(req: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const { user, role, admin, deny } = await requireUserWithRole();
  if (deny) return deny;
  const { job, deny: accessDeny } = await loadDesignJobWithAccess(admin, jobId, user.id, role);
  if (accessDeny) return accessDeny;

  const folder = await resolveDesignFolder(admin, job!);
  if (!folder.ok) return NextResponse.json({ error: folder.error }, { status: folder.status });
  const rel = req.nextUrl.searchParams.get('path') ?? '';
  const abs = resolveInside(folder.root, rel);
  if (!abs) return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });

  try {
    const { getDropboxClient } = await import('@/lib/dropbox/client');
    const dbx = getDropboxClient();
    let res = await dbx.filesListFolder({ path: abs, include_deleted: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = [...res.result.entries];
    for (let page = 0; res.result.has_more && page < 10; page++) {
      res = await dbx.filesListFolderContinue({ cursor: res.result.cursor });
      raw.push(...res.result.entries);
    }
    const entries: Entry[] = raw
      .filter(e => e['.tag'] === 'file' || e['.tag'] === 'folder')
      .map(e => ({
        name: e.name, tag: e['.tag'], path: relativeTo(folder.root, e.path_display) ?? e.name,
        size: e['.tag'] === 'file' ? e.size ?? null : null,
        modified: e['.tag'] === 'file' ? e.server_modified ?? null : null,
      }))
      .sort((a, b) => (a.tag === b.tag ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.tag === 'folder' ? -1 : 1));
    return NextResponse.json({ root: folder.root, path: relativeTo(folder.root, abs) ?? '', exists: true, entries, sharedUrl: folder.sharedUrl });
  } catch (e) {
    const msg = dropboxError(e);
    if (msg.includes('not_found')) return NextResponse.json({ root: folder.root, path: rel, exists: false, entries: [], sharedUrl: folder.sharedUrl });
    console.error('[design files GET]', msg);
    return NextResponse.json({ error: `Dropbox: ${msg}` }, { status: 502 });
  }
}

// { action: 'ensure' }                       create the folder tree (first open)
// { action: 'upload-link', path, fileName }  one-shot Dropbox upload link into `path` (big files)
// { action: 'uploaded', path }               the browser finished an upload — log it
// { action: 'mkdir', path, name }            new sub-folder
// { action: 'open', path }                   temporary download link for a file
// { action: 'share' }                        shared folder link for Sales
// { action: 'new-version' }                  create the next V{n} folder with its sub-folders
export async function POST(req: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const { user, role, admin, deny } = await requireUserWithRole();
  if (deny) return deny;
  const { job, deny: accessDeny } = await loadDesignJobWithAccess(admin, jobId, user.id, role);
  if (accessDeny) return accessDeny;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? '');
  const writes = ['ensure', 'upload-link', 'mkdir', 'new-version', 'share'].includes(action);
  const folder = await resolveDesignFolder(admin, job!, { create: writes });
  if (!folder.ok) return NextResponse.json({ error: folder.error }, { status: folder.status });
  const root = folder.root;
  const { getDropboxClient } = await import('@/lib/dropbox/client');
  const dbx = getDropboxClient();
  const anchor = { leadIntakeId: job!.lead_intake_id ?? undefined, opportunityId: job!.opportunity_id ?? undefined };

  try {
    if (action === 'ensure') {
      return NextResponse.json({ root, created: folder.created });
    }

    if (action === 'upload-link') {
      const dir = resolveInside(root, String(body.path ?? ''));
      const name = safeSegment(String(body.fileName ?? ''), '');
      if (!dir || !name) return NextResponse.json({ error: 'Invalid folder or file name' }, { status: 400 });
      const res = await dbx.filesGetTemporaryUploadLink({
        commit_info: { path: `${dir}/${name}`, mode: { '.tag': 'add' }, autorename: true },
        duration: 3600,
      });
      return NextResponse.json({ link: res.result.link });
    }

    if (action === 'uploaded') {
      const abs = resolveInside(root, String(body.path ?? ''));
      if (!abs) return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
      const meta = await dbx.filesGetMetadata({ path: abs });
      if (meta.result['.tag'] !== 'file') return NextResponse.json({ error: 'Not a file' }, { status: 400 });
      const rel = relativeTo(root, abs) ?? meta.result.name;
      await logLeadActivity(admin, { ...anchor, actorId: user.id, kind: 'change', body: `design file uploaded: ${rel}` });
      await logAudit({ actorId: user.id, action: 'design_job.file_uploaded', resource: `sales_design_job:${jobId}`, newValue: { path: rel } });
      return NextResponse.json({ ok: true, inVersion: rel.toLowerCase().startsWith(`${DESIGN_VERSION_BASE.toLowerCase()}/v`) });
    }

    if (action === 'mkdir') {
      const dir = resolveInside(root, String(body.path ?? ''));
      const name = safeSegment(String(body.name ?? ''), '');
      if (!dir || !name) return NextResponse.json({ error: 'Invalid folder name' }, { status: 400 });
      await dbx.filesCreateFolderV2({ path: `${dir}/${name}`, autorename: false });
      return NextResponse.json({ ok: true });
    }

    if (action === 'open') {
      const abs = resolveInside(root, String(body.path ?? ''));
      if (!abs || abs === root) return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
      const res = await dbx.filesGetTemporaryLink({ path: abs });
      return NextResponse.json({ link: res.result.link });
    }

    if (action === 'share') {
      const url = await ensureSharedLink(admin, jobId, root);
      return NextResponse.json({ url });
    }

    if (action === 'new-version') {
      const base = `${root}/${DESIGN_VERSION_BASE}`;
      let names: string[] = [];
      try {
        const list = await dbx.filesListFolder({ path: base });
        names = list.result.entries.filter(e => e['.tag'] === 'folder').map(e => e.name);
      } catch { /* base missing — created below */ }
      const { data: dbVersions } = await admin.from('sales_design_versions').select('version_no').eq('job_id', jobId);
      const no = Math.max(nextVersionNo(names), ...((dbVersions ?? []) as { version_no: number }[]).map(v => v.version_no + 1), 1);
      const vRoot = `${base}/V${no}`;
      const { createFolders } = await import('@/lib/dropbox/upload');
      await createFolders([vRoot, ...DESIGN_VERSION_SUBFOLDERS.map(s => `${vRoot}/${s}`)]);
      await logLeadActivity(admin, { ...anchor, actorId: user.id, kind: 'change', body: `design version V${no} folder created` });
      return NextResponse.json({ versionNo: no, path: relativeTo(root, vRoot) });
    }
  } catch (e) {
    const msg = dropboxError(e);
    console.error(`[design files ${action}]`, msg);
    return NextResponse.json({ error: `Dropbox: ${msg}` }, { status: 502 });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
