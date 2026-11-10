'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, ExternalLink, FileText, Folder, FolderPlus, Loader2, Radio, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/formatDate';
import { cn } from '@/lib/utils';
import { HEADING, formatBytes } from '@/components/platform/design/designShared';
import { useDropboxLive } from '@/hooks/use-dropbox-live';
import { dropboxProjectTopic } from '@/lib/realtime/broadcast';
import { FileViewer } from './FileViewer';

// Project "Files" tab: the project's whole Dropbox folder, live, both ways.
//   Dropbox → site: read straight from Dropbox; the webhook pings this tab when anything under
//                   the project folder changes, and the open folder reloads by itself.
//   site → Dropbox: Upload / drag & drop (any size, straight to Dropbox) and New folder.
// Nothing here deletes, moves or renames in Dropbox.

interface Entry { name: string; path: string; tag: 'file' | 'folder'; size: number | null; modified: string | null }

export function ProjectFiles({ projectId }: { projectId: string }) {
  const api = `/api/projects/${projectId}/files`;
  const [path, setPath] = useState('');
  const [root, setRoot] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [exists, setExists] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null); // index into the folder's files
  const inputRef = useRef<HTMLInputElement>(null);
  const pathRef = useRef(path);
  useEffect(() => { pathRef.current = path; }, [path]);

  const post = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(b.error ?? 'Dropbox request failed');
    return b;
  }, [api]);

  const load = useCallback(async (p: string, quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${api}?path=${encodeURIComponent(p)}`);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? 'Could not load the folder');
      if (p !== pathRef.current) return; // the user moved on meanwhile
      setRoot(b.root); setEntries(b.entries ?? []); setExists(b.exists !== false);
    } catch (e) {
      if (!quiet) setError(e instanceof Error ? e.message : 'Could not load the folder');
    } finally { if (!quiet) setLoading(false); }
  }, [api]);

  useEffect(() => { void load(path); }, [load, path]);

  // Live: something changed in this project's Dropbox folder → reload the open folder quietly.
  useDropboxLive(dropboxProjectTopic(projectId), () => void load(pathRef.current, true));

  async function uploadOne(f: File) {
    const { link, path: target } = await post({ action: 'upload-link', path, fileName: f.name });
    const send = async (contentType: string) => {
      const up = await fetch(link, { method: 'POST', headers: { 'Content-Type': contentType }, body: f });
      if (!up.ok) throw new Error(`Dropbox rejected ${f.name}`);
    };
    // Documented content type first; if the browser's CORS preflight rejects it (the link is
    // still unused then), Dropbox's no-preflight type.
    try { await send('application/octet-stream'); }
    catch {
      try { await send('text/plain; charset=dropbox-cors-hack'); }
      catch (e) { if (!(e instanceof TypeError)) throw e; } // reply lost — the server checks below
    }
    // The server confirms the file is really there (and adds a version-folder PDF to documents).
    return post({ action: 'uploaded', path: target }) as Promise<{ synced?: number }>;
  }

  async function upload(files: File[]) {
    if (!files.length || !root) return;
    setUploading({ done: 0, total: files.length });
    let failed = 0, synced = 0;
    for (const [i, f] of files.entries()) {
      try { synced += (await uploadOne(f)).synced ?? 0; }
      catch (e) { failed += 1; toast.error(e instanceof Error ? e.message : `Could not upload ${f.name}`); }
      setUploading({ done: i + 1, total: files.length });
    }
    setUploading(null);
    const n = files.length - failed;
    if (n) toast.success(`${n} file${n === 1 ? '' : 's'} uploaded to Dropbox${synced ? ` · ${synced} added to documents` : ''}`);
    void load(path, true);
  }

  const folderFiles = entries.filter(e => e.tag === 'file');
  useEffect(() => { setViewing(null); }, [path]);

  // A file opens in the viewer — never a download by itself.
  function openEntry(e: Entry) {
    if (e.tag === 'folder') { setPath(e.path); return; }
    setViewing(folderFiles.findIndex(f => f.path === e.path));
  }

  async function linkFor(p: string): Promise<string> {
    try { return (await post({ action: 'open', path: p })).link as string; }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Could not reach the file'); throw err; }
  }

  async function newFolder() {
    const name = window.prompt('New folder name');
    if (!name?.trim()) return;
    setBusy(true);
    try { await post({ action: 'mkdir', path, name: name.trim() }); toast.success('Folder created in Dropbox'); void load(path, true); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not create the folder'); }
    finally { setBusy(false); }
  }

  const crumbs = path ? path.split('/') : [];
  const dropboxUrl = root ? `https://www.dropbox.com/home${encodeURI(path ? `${root}/${path}` : root)}` : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Folder" className="flex min-w-0 flex-wrap items-center gap-1 text-[13px]">
          <button type="button" onClick={() => setPath('')} className={cn('border-0 bg-transparent p-0 font-semibold hover:underline', HEADING)}>Project folder</button>
          {crumbs.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <ChevronRight size={13} aria-hidden className="text-ui-text-secondary" />
              <button type="button" onClick={() => setPath(crumbs.slice(0, i + 1).join('/'))} className="border-0 bg-transparent p-0 text-ui-body hover:underline">{c}</button>
            </span>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-ui-text-secondary" title="Changes in Dropbox show up here by themselves">
            <Radio size={12} aria-hidden /> Live
          </span>
          <Button variant="ghost" size="sm" onClick={() => void load(path)} disabled={loading} aria-label="Reload"><RefreshCw className={loading ? 'animate-spin' : undefined} /></Button>
          <Button variant="outline" size="sm" onClick={newFolder} disabled={busy || !exists || !root}><FolderPlus /> New folder</Button>
          {dropboxUrl && <a href={dropboxUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-[4px] border border-primary-700 px-3 text-[13px] text-primary-700 no-underline hover:bg-primary-50 dark:border-[var(--ui-control-border)] dark:text-ui-heading dark:hover:bg-white/5"><ExternalLink size={14} /> Open in Dropbox</a>}
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={!!uploading || !exists || !root}><Upload /> Upload</Button>
          <input ref={inputRef} type="file" multiple hidden onChange={e => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; void upload(fs); }} />
        </div>
      </div>

      <div
        onDragOver={e => { if (exists && root) { e.preventDefault(); setDragOver(true); } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); void upload([...e.dataTransfer.files]); }}
        className={cn('min-h-[260px] rounded-[8px] border bg-ui-surface transition-colors', dragOver ? 'border-dashed border-[var(--color-secondary-700)] dark:border-ui-heading' : 'border-ui-divider')}
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
          <EmptyState icon={<Folder />} title="This folder doesn’t exist in Dropbox" description="It may have been moved or not created yet." />
        ) : entries.length === 0 ? (
          <EmptyState icon={<Upload />} title="Empty folder" description="Drop files here or use Upload — they go straight to Dropbox." />
        ) : (
          <ul className="m-0 list-none divide-y divide-ui-divider p-0">
            {entries.map(e => (
              <li key={e.path}>
                <button type="button" onClick={() => void openEntry(e)} className="flex w-full items-center gap-3 border-0 bg-transparent px-4 py-2.5 text-left hover:bg-ui-hover-bg">
                  {e.tag === 'folder' ? <Folder size={16} aria-hidden className="shrink-0 text-ui-text-secondary" /> : <FileText size={16} aria-hidden className="shrink-0 text-ui-text-secondary" />}
                  <span className={cn('min-w-0 flex-1 truncate text-[13px]', e.tag === 'folder' ? cn('font-medium', HEADING) : 'text-ui-body')}>{e.name}</span>
                  {e.tag === 'file' && <span className="w-[70px] text-right text-[11px] text-ui-text-secondary">{formatBytes(e.size)}</span>}
                  {e.tag === 'file' && <span className="hidden w-[90px] text-right text-[11px] text-ui-text-secondary sm:inline">{formatDate(e.modified)}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {root && <p className="m-0 break-all font-mono text-[10.5px] text-ui-text-secondary">{root}{path ? `/${path}` : ''}</p>}
      {viewing != null && folderFiles[viewing] && (
        <FileViewer
          projectId={projectId} files={folderFiles} index={viewing} onIndex={setViewing}
          onClose={() => setViewing(null)} getLink={linkFor} formatBytes={formatBytes}
        />
      )}
    </div>
  );
}
