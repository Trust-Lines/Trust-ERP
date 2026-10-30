'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, ExternalLink, FileText, Folder, FolderPlus, Link2, Loader2, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/formatDate';
import { cn } from '@/lib/utils';
import { DESIGN_QUICK_FOLDERS, DESIGN_VERSION_BASE, relativeTo } from '@/lib/sales/designPaths';
import { HEADING, formatBytes } from './designShared';

interface Entry { name: string; path: string; tag: 'file' | 'folder'; size: number | null; modified: string | null }

const filesApi = (jobId: string) => `/api/design-jobs/${jobId}/files`;

async function postFiles(jobId: string, body: Record<string, unknown>) {
  const res = await fetch(filesApi(jobId), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const b = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(b.error ?? 'Dropbox request failed');
  return b;
}

/**
 * Upload one file straight to Dropbox into `folder` (relative to the job's design folder) through a
 * one-shot link — no 4.5 MB serverless cap, so renders and SKP files go through. Returns whether
 * the file landed inside a version folder (the caller then syncs versions).
 */
export async function uploadToDesignFolder(jobId: string, root: string, folder: string, file: File): Promise<{ inVersion: boolean }> {
  const { link } = await postFiles(jobId, { action: 'upload-link', path: folder, fileName: file.name });
  let stored: string | null = null;
  // Documented content type first; if the browser's CORS preflight rejects it the link is still
  // unused, so retry with Dropbox's no-preflight type.
  for (const contentType of ['application/octet-stream', 'text/plain; charset=dropbox-cors-hack']) {
    try {
      const up = await fetch(link, { method: 'POST', headers: { 'Content-Type': contentType }, body: file });
      if (!up.ok) throw new Error(`Dropbox rejected ${file.name}`);
      const meta = await up.json().catch(() => null) as { path_lower?: string; path_display?: string } | null;
      stored = meta?.path_display ?? meta?.path_lower ?? null;
      break;
    } catch (e) {
      if (contentType.startsWith('text/plain')) throw e;
    }
  }
  if (!stored) throw new Error(`Could not upload ${file.name}`);
  const rel = relativeTo(root, stored) ?? `${folder}/${file.name}`;
  const done = await postFiles(jobId, { action: 'uploaded', path: rel });
  return { inVersion: !!done.inVersion };
}

export function DesignFiles({ jobId, initialPath = '', onVersionFiles, onSharedUrl }: {
  jobId: string;
  initialPath?: string;
  /** Files were added under a V{n} folder → sync versions. */
  onVersionFiles: () => void;
  onSharedUrl?: (url: string) => void;
}) {
  const [path, setPath] = useState(initialPath);
  const [root, setRoot] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [exists, setExists] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setPath(initialPath); }, [initialPath]);

  const load = useCallback(async (p: string) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${filesApi(jobId)}?path=${encodeURIComponent(p)}`);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? 'Could not load the folder');
      setRoot(b.root); setEntries(b.entries ?? []); setExists(b.exists !== false);
      if (b.sharedUrl) onSharedUrl?.(b.sharedUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the folder');
    } finally { setLoading(false); }
  }, [jobId, onSharedUrl]);

  useEffect(() => { void load(path); }, [load, path]);

  async function act(body: Record<string, unknown>, ok?: string) {
    setBusy(true);
    try {
      const b = await postFiles(jobId, body);
      if (ok) toast.success(ok);
      return b;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Dropbox request failed');
      return null;
    } finally { setBusy(false); }
  }

  async function createFolderTree() {
    const b = await act({ action: 'ensure' }, 'Design folder created in Dropbox');
    if (b) void load(path);
  }

  async function upload(files: File[]) {
    if (!files.length || !root) return;
    setUploading({ done: 0, total: files.length });
    let anyVersion = false, failed = 0;
    for (const [i, f] of files.entries()) {
      try {
        const r = await uploadToDesignFolder(jobId, root, path, f);
        anyVersion ||= r.inVersion;
      } catch (e) {
        failed += 1;
        toast.error(e instanceof Error ? e.message : `Could not upload ${f.name}`);
      }
      setUploading({ done: i + 1, total: files.length });
    }
    setUploading(null);
    if (failed < files.length) toast.success(`${files.length - failed} file${files.length - failed === 1 ? '' : 's'} uploaded — Sales can see ${files.length - failed === 1 ? 'it' : 'them'} too`);
    void load(path);
    if (anyVersion) onVersionFiles();
  }

  async function openEntry(e: Entry) {
    if (e.tag === 'folder') { setPath(e.path); return; }
    const win = window.open('', '_blank');
    const b = await act({ action: 'open', path: e.path });
    if (b?.link) { if (win) win.location.href = b.link; else window.open(b.link, '_blank', 'noopener,noreferrer'); }
    else win?.close();
  }

  async function newFolder() {
    const name = window.prompt('New folder name');
    if (!name?.trim()) return;
    const b = await act({ action: 'mkdir', path, name: name.trim() }, 'Folder created');
    if (b) void load(path);
  }

  async function share() {
    const b = await act({ action: 'share' });
    if (!b?.url) return;
    onSharedUrl?.(b.url);
    try { await navigator.clipboard.writeText(b.url); toast.success('Folder link copied — Sales sees it on the deal too'); }
    catch { toast.success(`Folder link: ${b.url}`); }
  }

  const crumbs = path ? path.split('/') : [];
  const dropboxUrl = root ? `https://www.dropbox.com/home${encodeURI(path ? `${root}/${path}` : root)}` : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {DESIGN_QUICK_FOLDERS.map(q => (
          <button
            key={q.path} type="button" onClick={() => setPath(q.path)} aria-pressed={path === q.path}
            className="h-7 rounded-[4px] border border-ui-divider bg-ui-surface-elevated px-2.5 text-[12px] text-ui-body hover:bg-ui-hover-bg aria-pressed:border-[var(--color-secondary-700)] aria-pressed:font-semibold dark:aria-pressed:border-ui-heading"
          >
            {q.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Folder" className="flex min-w-0 flex-wrap items-center gap-1 text-[13px]">
          <button type="button" onClick={() => setPath('')} className={cn('border-0 bg-transparent p-0 font-semibold hover:underline', HEADING)}>Design folder</button>
          {crumbs.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <ChevronRight size={13} aria-hidden className="text-ui-text-secondary" />
              <button type="button" onClick={() => setPath(crumbs.slice(0, i + 1).join('/'))} className="border-0 bg-transparent p-0 text-ui-body hover:underline">{c}</button>
            </span>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void load(path)} disabled={loading} aria-label="Refresh"><RefreshCw className={loading ? 'animate-spin' : undefined} /></Button>
          <Button variant="outline" size="sm" onClick={newFolder} disabled={busy || !exists}><FolderPlus /> New folder</Button>
          <Button variant="outline" size="sm" onClick={share} disabled={busy}><Link2 /> Share with Sales</Button>
          {dropboxUrl && <a href={dropboxUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-primary-700 px-3 text-[13px] text-primary-700 no-underline hover:bg-primary-50 dark:border-[var(--ui-control-border)] dark:text-ui-heading dark:hover:bg-white/5"><ExternalLink size={14} /> Open in Dropbox</a>}
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={!!uploading || !exists || !root}><Upload /> Upload</Button>
          <input ref={inputRef} type="file" multiple hidden onChange={e => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; void upload(fs); }} />
        </div>
      </div>

      {path.toLowerCase().startsWith(DESIGN_VERSION_BASE.toLowerCase()) && (
        <p className="m-0 rounded-[6px] bg-ui-surface-elevated px-3 py-2 text-[12px] text-ui-body">
          Files inside a <b>V1, V2…</b> folder here become that design version automatically (Versions tab).
        </p>
      )}

      <div
        onDragOver={e => { if (exists && root) { e.preventDefault(); setDragOver(true); } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); void upload([...e.dataTransfer.files]); }}
        className={cn('min-h-[220px] rounded-[8px] border bg-ui-surface transition-colors', dragOver ? 'border-dashed border-[var(--color-secondary-700)] dark:border-ui-heading' : 'border-ui-divider')}
      >
        {uploading && (
          <div className="flex items-center gap-2 border-b border-ui-divider px-4 py-2 text-[12px] text-ui-body">
            <Loader2 size={14} className="animate-spin" aria-hidden /> Uploading {uploading.done} of {uploading.total}…
          </div>
        )}
        {error ? (
          <div className="p-5 text-[13px] text-error-normal">{error}</div>
        ) : loading && entries.length === 0 ? (
          <div className="p-5 text-[13px] text-ui-text-secondary">Loading…</div>
        ) : !exists ? (
          <EmptyState
            icon={<Folder />} title={path ? 'This folder doesn’t exist yet' : 'No design folder yet'}
            description={path ? 'Create the folder tree, then upload.' : 'Creates the standard design folders in Dropbox (Plan Layout, Estimate, Design proposal…).'}
            action={<Button size="sm" onClick={createFolderTree} disabled={busy}><FolderPlus /> Create design folder</Button>}
          />
        ) : entries.length === 0 ? (
          <EmptyState icon={<Upload />} title="Empty folder" description="Drop files here or use Upload." />
        ) : (
          <ul className="m-0 list-none divide-y divide-ui-divider p-0">
            {entries.map(e => (
              <li key={e.path}>
                <button type="button" onClick={() => void openEntry(e)} className="flex w-full items-center gap-3 border-0 bg-transparent px-4 py-2.5 text-left hover:bg-ui-hover-bg">
                  {e.tag === 'folder' ? <Folder size={16} aria-hidden className="shrink-0 text-ui-text-secondary" /> : <FileText size={16} aria-hidden className="shrink-0 text-ui-text-secondary" />}
                  <span className={cn('min-w-0 flex-1 truncate text-[13px]', e.tag === 'folder' ? cn('font-medium', HEADING) : 'text-ui-body')}>{e.name}</span>
                  {e.tag === 'file' && <span className="w-[70px] text-right text-[11px] text-ui-text-secondary">{formatBytes(e.size)}</span>}
                  {e.tag === 'file' && <span className="w-[90px] text-right text-[11px] text-ui-text-secondary">{formatDate(e.modified)}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {root && <p className="m-0 break-all font-mono text-[10.5px] text-ui-text-secondary">{root}{path ? `/${path}` : ''}</p>}
    </div>
  );
}
