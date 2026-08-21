'use client';

import { useState, useEffect, useCallback } from 'react';
import { Folder, File as FileIcon, Loader2, ChevronRight } from 'lucide-react';

interface FolderEntry { name: string; path: string }
interface FileEntry { name: string; path: string; size?: number }

function formatSize(bytes?: number): string {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DropboxFileList({ rootPath, rootLabel }: { rootPath: string; rootLabel: string }) {
  const [path, setPath] = useState(rootPath);
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: string) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/dropbox/list-folders?${new URLSearchParams({ path: p, includeFiles: 'true' })}`);
      const data = await res.json() as { folders?: FolderEntry[]; files?: FileEntry[]; error?: string };
      if (data.error) throw new Error(data.error);
      setFolders(data.folders ?? []);
      setFiles(data.files ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load folder');
      setFolders([]); setFiles([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { setPath(rootPath); }, [rootPath]);
  useEffect(() => { load(path); }, [path, load]);

  const crumbs = path === rootPath ? [] : path.slice(rootPath.length).split('/').filter(Boolean);

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)', fontSize: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setPath(rootPath)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: crumbs.length ? 'var(--brand-teal)' : 'var(--fg-default)', fontWeight: crumbs.length ? 400 : 600, padding: 0 }}>
          {rootLabel}
        </button>
        {crumbs.map((seg, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ChevronRight size={11} color="var(--fg-faint)" />
            <button
              onClick={() => setPath([rootPath, ...crumbs.slice(0, i + 1)].join('/'))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: i === crumbs.length - 1 ? 'var(--fg-default)' : 'var(--brand-teal)', fontWeight: i === crumbs.length - 1 ? 600 : 400, padding: 0 }}
            >
              {seg}
            </button>
          </span>
        ))}
      </div>
      <div style={{ maxHeight: 260, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-subtle)' }}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /></div>
        ) : error ? (
          <div style={{ padding: 16, fontSize: 12.5, color: 'var(--status-danger)' }}>{error}</div>
        ) : folders.length === 0 && files.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-faint)', fontSize: 12.5 }}>Empty folder.</div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: '4px 0' }}>
            {folders.map(f => (
              <li key={f.path}>
                <button
                  onClick={() => setPath(f.path)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Folder size={14} color="var(--brand-teal)" />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                </button>
              </li>
            ))}
            {files.map(f => (
              <li key={f.path} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', fontSize: 12.5, color: 'var(--fg-subtle)' }}>
                <FileIcon size={14} color="var(--fg-faint)" />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                {f.size !== undefined && <span style={{ fontSize: 11, color: 'var(--fg-faint)', flexShrink: 0 }}>{formatSize(f.size)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
