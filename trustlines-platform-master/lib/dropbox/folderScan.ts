// Folder scan for Dropbox Matching: walks the connected Dropbox's folder tree down to project
// folders and keeps it in dropbox_folder_index. Breadth-first, a slice per call (each call stays
// well inside a serverless time limit), resumable: the unlisted folders are the queue.
//
// Read-only on Dropbox: list_folder only.

import type { Dropbox } from 'dropbox';
import { looksLikeProject } from './match';
import { dropboxErrorInfo, withDropboxRetry } from './errors';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Where projects live. Comma-separated env override for a drive laid out differently. */
export const SCAN_ROOTS = (process.env.DROPBOX_SCAN_ROOTS ?? '/D-Projects').split(',').map(s => s.trim()).filter(Boolean);
const MAX_DEPTH = 10;      // below a root; project folders sit around depth 6–7
const PARALLEL = 6;

export interface ScanMeta { account: string; roots: string[]; startedAt: string; finishedAt: string | null }
export interface ScanStatus { meta: ScanMeta | null; folders: number; projectLike: number; remaining: number; done: boolean }

async function readMeta(admin: any): Promise<ScanMeta | null> {
  const { data } = await admin.from('dropbox_sync_state').select('cursor').eq('id', 'folder_scan').maybeSingle();
  try { return data?.cursor ? JSON.parse(data.cursor) as ScanMeta : null; } catch { return null; }
}
const writeMeta = (admin: any, meta: ScanMeta) =>
  admin.from('dropbox_sync_state').upsert({ id: 'folder_scan', cursor: JSON.stringify(meta), updated_at: new Date().toISOString() });

async function count(admin: any, filter: (q: any) => any): Promise<number> {
  const { count: n } = await filter(admin.from('dropbox_folder_index').select('path_lower', { count: 'exact', head: true }));
  return n ?? 0;
}

export async function scanStatus(admin: any): Promise<ScanStatus> {
  const [meta, folders, projectLike, remaining] = await Promise.all([
    readMeta(admin),
    count(admin, q => q),
    count(admin, q => q.eq('project_like', true)),
    count(admin, q => q.eq('listed', false).eq('project_like', false)),
  ]);
  return { meta, folders, projectLike, remaining, done: !!meta?.finishedAt && remaining === 0 };
}

/** Start over: forget the index and queue the roots. */
export async function resetScan(admin: any, dbx: Dropbox): Promise<void> {
  const account = (await dbx.usersGetCurrentAccount()).result.account_id;
  await admin.from('dropbox_folder_index').delete().neq('path_lower', '');
  const rows = SCAN_ROOTS.map(r => ({ path_lower: r.toLowerCase(), path_display: r, name: r.split('/').pop() || r, parent_lower: null, depth: 0 }));
  await admin.from('dropbox_folder_index').upsert(rows);
  await writeMeta(admin, { account, roots: SCAN_ROOTS, startedAt: new Date().toISOString(), finishedAt: null });
}

async function listChildren(dbx: Dropbox, path: string): Promise<{ name: string; path_display: string; path_lower: string }[]> {
  const out: { name: string; path_display: string; path_lower: string }[] = [];
  let res = await withDropboxRetry(() => dbx.filesListFolder({ path, include_deleted: false }));
  for (;;) {
    for (const e of res.result.entries) {
      if (e['.tag'] === 'folder') out.push({ name: e.name, path_display: e.path_display ?? '', path_lower: e.path_lower ?? '' });
    }
    if (!res.result.has_more) break;
    const cursor = res.result.cursor;
    res = await withDropboxRetry(() => dbx.filesListFolderContinue({ cursor }));
  }
  return out;
}

/**
 * List the next unlisted folders until `budgetMs` runs out. A new account or new roots start the
 * index over. Returns the status after this slice.
 */
export async function scanStep(admin: any, dbx: Dropbox, budgetMs = 200_000): Promise<ScanStatus> {
  const started = Date.now();
  const meta = await readMeta(admin);
  const account = (await dbx.usersGetCurrentAccount()).result.account_id;
  if (!meta || meta.account !== account || meta.roots.join('|') !== SCAN_ROOTS.join('|')) await resetScan(admin, dbx);

  while (Date.now() - started < budgetMs) {
    const { data: todo } = await admin.from('dropbox_folder_index')
      .select('path_lower, path_display, depth')
      .eq('listed', false).eq('project_like', false)
      .order('depth', { ascending: true }).limit(PARALLEL * 4);
    if (!todo?.length) break;

    for (let i = 0; i < todo.length && Date.now() - started < budgetMs; i += PARALLEL) {
      await Promise.all(todo.slice(i, i + PARALLEL).map(async (f: { path_lower: string; path_display: string; depth: number }) => {
        let children: Awaited<ReturnType<typeof listChildren>> = [];
        try { children = await listChildren(dbx, f.path_display); }
        catch (e) { if (!dropboxErrorInfo(e).notFound) throw e; } // gone since queued: just mark it
        const depth = f.depth + 1;
        const rows = children.map(c => {
          const projectLike = looksLikeProject(c.name);
          return {
            path_lower: c.path_lower, path_display: c.path_display, name: c.name, parent_lower: f.path_lower, depth,
            project_like: projectLike,
            // Project folders and anything too deep are not opened.
            listed: projectLike || depth >= MAX_DEPTH,
            scanned_at: new Date().toISOString(),
          };
        });
        for (let j = 0; j < rows.length; j += 500) {
          const { error } = await admin.from('dropbox_folder_index').upsert(rows.slice(j, j + 500));
          if (error) throw new Error(error.message);
        }
        await admin.from('dropbox_folder_index').update({ listed: true, scanned_at: new Date().toISOString() }).eq('path_lower', f.path_lower);
      }));
    }
  }

  const status = await scanStatus(admin);
  if (status.remaining === 0 && status.meta && !status.meta.finishedAt) {
    status.meta.finishedAt = new Date().toISOString();
    await writeMeta(admin, status.meta);
    status.done = true;
  }
  return status;
}

/** All project-like folders (paged past PostgREST's 1000-row cap). */
export async function projectFolders(admin: any): Promise<{ path_lower: string; path_display: string; name: string }[]> {
  const out: { path_lower: string; path_display: string; name: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from('dropbox_folder_index')
      .select('path_lower, path_display, name').eq('project_like', true)
      .order('path_lower').range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
