// Server-side Dropbox helpers for the Design library: one-shot upload links into a fixed folder,
// and checking that an uploaded path really is a file inside that folder before it's indexed.
import { getDropboxClient } from '@/lib/dropbox/client';
import { relativeTo, safeSegment } from '@/lib/sales/designPaths';

/** Upload link for `folder/fileName` — add + autorename, never overwrites. Dropbox creates missing parent folders. */
export async function uploadLinkIn(folder: string, fileName: string): Promise<string | null> {
  const name = safeSegment(fileName, '');
  if (!name) return null;
  const res = await getDropboxClient().filesGetTemporaryUploadLink({
    commit_info: { path: `${folder}/${name}`, mode: { '.tag': 'add' }, autorename: true },
    duration: 3600,
  });
  return res.result.link;
}

/** The file's metadata when `path` is a file somewhere under `folder`, else null. */
export async function fileIn(folder: string, path: string): Promise<{ path: string; name: string; size: number } | null> {
  const p = String(path ?? '').trim();
  if (!p || p.includes('..') || relativeTo(folder, p) == null) return null;
  try {
    const meta = await getDropboxClient().filesGetMetadata({ path: p });
    if (meta.result['.tag'] !== 'file') return null;
    const f = meta.result as { path_display?: string; name: string; size: number };
    return { path: f.path_display ?? p, name: f.name, size: f.size };
  } catch {
    return null;
  }
}

export async function temporaryLink(path: string): Promise<string> {
  return (await getDropboxClient().filesGetTemporaryLink({ path })).result.link;
}

/** Files directly inside `folder` (not recursive); [] when the folder doesn't exist yet. */
export async function listFiles(folder: string): Promise<{ name: string; path: string; size: number; modified: string }[]> {
  try {
    const res = await getDropboxClient().filesListFolder({ path: folder });
    return res.result.entries
      .filter(e => e['.tag'] === 'file')
      .map(e => { const f = e as { name: string; path_display?: string; size: number; server_modified: string }; return { name: f.name, path: f.path_display ?? '', size: f.size, modified: f.server_modified }; })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  } catch (e) {
    if (dropboxError(e).includes('not_found')) return [];
    throw e;
  }
}

export function dropboxError(e: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const err = e as any;
  return err?.error?.error_summary ?? (e instanceof Error ? e.message : 'Dropbox error');
}
