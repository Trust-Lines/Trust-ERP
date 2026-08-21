'use client';

import { useState, useEffect, useCallback } from 'react';

export interface DropboxProjectSelection {
  dropboxPath:        string;
  projectNo:          string;
  address:            string;
  projectName:        string;
  dropboxSection:     string;
  dropboxRegion:      string;
  dropboxStatus:      'Under Working' | 'Done';
  dropboxClientType:  'Clients' | 'Individuals';
  dropboxClientName?: string;
  detectedCategories: string[];
}

interface FolderEntry { name: string; path: string }
interface FileEntry   { name: string; path: string; size?: number }

interface Props {
  onSelect: (info: DropboxProjectSelection) => void;
  onCancel: () => void;
}

const ROOT_PATH = '/D-Projects/T LINES';

function isAtProjectLevel(path: string): boolean {
  const segments = path.split('/').filter(Boolean);
  const lastSeg  = segments[segments.length - 1] ?? '';

  if (lastSeg === 'Individiuals') return true;

  const clientsIdx = segments.lastIndexOf('Clients');
  if (clientsIdx !== -1 && segments.length === clientsIdx + 2) return true;

  return false;
}

function parsePath(fullPath: string): DropboxProjectSelection | null {
  const segments = fullPath.split('/').filter(Boolean);

  if (segments.length < 7) return null;

  const section    = segments[2] ?? '';
  const region     = segments[3] ?? '';
  const rawStatus  = segments[4] ?? '';
  const rawClient  = segments[5] ?? '';

  const dropboxStatus: 'Under Working' | 'Done' =
    rawStatus === 'Done' ? 'Done' : 'Under Working';

  const dropboxClientType: 'Clients' | 'Individuals' =
    rawClient === 'Individiuals' ? 'Individuals' : 'Clients';

  const projectFolder = segments[segments.length - 1] ?? '';

  let dropboxClientName: string | undefined;
  if (dropboxClientType === 'Clients' && segments.length >= 8) {
    dropboxClientName = segments[6];
  }

  const match = projectFolder.match(/^(\w[\w\s]*?)\s*-\s*(.+)$/);
  if (!match) return null;

  const address = match[2].trim();

  const projectName = dropboxClientType === 'Clients'
    ? (dropboxClientName ?? address)
    : address;

  return {
    dropboxPath:      fullPath,
    projectNo:        match[1].trim(),
    address,
    projectName,
    dropboxSection:   section,
    dropboxRegion:    region,
    dropboxStatus,
    dropboxClientType,
    dropboxClientName,
    detectedCategories: [],
  };
}

async function detectCategories(projectPath: string): Promise<string[]> {
  try {
    const rootRes = await fetch(
      `/api/dropbox/list-folders?${new URLSearchParams({ path: projectPath })}`,
    );
    if (!rootRes.ok) {
      console.warn('[detectCategories] root list failed', rootRes.status);
      return [];
    }
    const rootData = await rootRes.json() as { folders?: { name: string; path: string }[] };
    const prodFolder = (rootData.folders ?? []).find(f =>
      f.name.toLowerCase().includes('production'),
    );
    if (!prodFolder) {
      console.warn('[detectCategories] no production folder found in', projectPath);
      return [];
    }

    const prodRes = await fetch(
      `/api/dropbox/list-folders?${new URLSearchParams({ path: prodFolder.path })}`,
    );
    if (!prodRes.ok) {
      console.warn('[detectCategories] prod folder list failed', prodRes.status);
      return [];
    }
    const prodData = await prodRes.json() as { folders?: { name: string }[] };

    return (prodData.folders ?? [])
      .map(f => f.name)
      .filter(n => n && n !== '0-Missing-Extra');
  } catch (err) {
    console.error('[detectCategories] error', err);
    return [];
  }
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DropboxProjectBrowser({ onSelect, onCancel }: Props) {
  const [currentPath, setCurrentPath] = useState(ROOT_PATH);
  const [folders, setFolders]         = useState<FolderEntry[]>([]);
  const [files, setFiles]             = useState<FileEntry[]>([]);
  const [loading, setLoading]         = useState(false);
  const [selecting, setSelecting]     = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);

  const loadPath = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ path, includeFiles: 'true' });
      const res    = await fetch(`/api/dropbox/list-folders?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as {
        folders?: FolderEntry[];
        files?:   FileEntry[];
        error?:   string;
      };
      if (data.error) throw new Error(data.error);
      setFolders(data.folders ?? []);
      setFiles(data.files ?? []);
    } catch (err) {
      setError('Could not load folder. ' + (err instanceof Error ? err.message : String(err)));
      setFolders([]);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPath(currentPath);
  }, [currentPath, loadPath]);

  const breadcrumbSegments = currentPath
    .replace(ROOT_PATH, '')
    .split('/')
    .filter(Boolean);

  function navigateToBreadcrumb(index: number) {
    if (index < 0) {
      setCurrentPath(ROOT_PATH);
    } else {
      const parts = [ROOT_PATH, ...breadcrumbSegments.slice(0, index + 1)];
      setCurrentPath(parts.join('/'));
    }
  }

  async function handleFolderClick(folder: FolderEntry) {
    if (isAtProjectLevel(currentPath)) {
      const base = parsePath(folder.path);
      if (!base) return;
      setSelecting(folder.path);
      const cats = await detectCategories(folder.path);
      setSelecting(null);
      onSelect({ ...base, detectedCategories: cats });
    } else {
      setCurrentPath(folder.path);
    }
  }

  return (
    <div style={{
      border:       '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      background:   'var(--bg-surface)',
      overflow:     'hidden',
    }}>
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '10px 14px',
        borderBottom:   '1px solid var(--border-subtle)',
        background:     'var(--bg-subtle)',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-default)' }}>
          Browse Dropbox
        </span>
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: 'none',
            border:     'none',
            cursor:     'pointer',
            color:      'var(--fg-subtle)',
            fontSize:   16,
            lineHeight: 1,
            padding:    '2px 4px',
          }}
          aria-label="Close browser"
        >
          ✕
        </button>
      </div>

      <div style={{
        display:    'flex',
        alignItems: 'center',
        flexWrap:   'wrap',
        gap:        2,
        padding:    '8px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        fontSize:   12,
        fontFamily: 'var(--font-mono)',
        color:      'var(--fg-subtle)',
      }}>
        <button
          type="button"
          onClick={() => navigateToBreadcrumb(-1)}
          style={{
            background: 'none',
            border:     'none',
            cursor:     'pointer',
            color:      'var(--brand-teal)',
            fontFamily: 'var(--font-mono)',
            fontSize:   12,
            padding:    '0 2px',
          }}
        >
          T LINES
        </button>
        {breadcrumbSegments.map((seg, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <span style={{ color: 'var(--fg-faint)', padding: '0 1px' }}>/</span>
            <button
              type="button"
              onClick={() => navigateToBreadcrumb(i)}
              style={{
                background: 'none',
                border:     'none',
                cursor:     i < breadcrumbSegments.length - 1 ? 'pointer' : 'default',
                color:      i < breadcrumbSegments.length - 1 ? 'var(--brand-teal)' : 'var(--fg-default)',
                fontFamily: 'var(--font-mono)',
                fontSize:   12,
                padding:    '0 2px',
                fontWeight: i === breadcrumbSegments.length - 1 ? 600 : 400,
              }}
              disabled={i === breadcrumbSegments.length - 1}
            >
              {seg}
            </button>
          </span>
        ))}
      </div>

      <div style={{ minHeight: 120, maxHeight: 340, overflowY: 'auto' }}>
        {loading && (
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            padding:        '32px 0',
            gap:            10,
            color:          'var(--fg-subtle)',
            fontSize:       13,
          }}>
            <span className="dbx-spinner" />
            Loading…
          </div>
        )}

        {!loading && error && (
          <div style={{
            padding:  '14px 16px',
            color:    'var(--status-danger)',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {!loading && !error && folders.length === 0 && files.length === 0 && (
          <div style={{
            padding:  '24px 16px',
            color:    'var(--fg-subtle)',
            fontSize: 13,
            textAlign: 'center',
          }}>
            This folder is empty.
          </div>
        )}

        {!loading && !error && (
          <ul style={{ listStyle: 'none', margin: 0, padding: '4px 0' }}>
            {folders.map(folder => {
              const isProject = isAtProjectLevel(currentPath);
              return (
                <li key={folder.path}>
                  <div style={{
                    display:     'flex',
                    alignItems:  'center',
                    gap:         10,
                    padding:     '7px 14px',
                    cursor:      'pointer',
                    transition:  'background var(--dur-fast)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => !isProject && handleFolderClick(folder)}
                  >
                    <span style={{
                      fontSize:   16,
                      flexShrink: 0,
                      filter:     isProject ? 'none' : undefined,
                      color:      isProject ? 'var(--brand-teal)' : 'var(--fg-muted)',
                    }}>
                      {isProject ? '📁' : '📂'}
                    </span>

                    <span style={{
                      flex:     1,
                      fontSize: 13,
                      color:    isProject ? 'var(--brand-teal)' : 'var(--fg-default)',
                      fontWeight: isProject ? 600 : 400,
                      overflow:   'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {folder.name}
                    </span>

                    {isProject ? (
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={selecting !== null}
                        onClick={e => { e.stopPropagation(); void handleFolderClick(folder); }}
                        style={{
                          background:   'var(--brand-teal)',
                          color:        '#fff',
                          border:       'none',
                          borderRadius: 'var(--radius-sm)',
                          padding:      '3px 10px',
                          fontSize:     12,
                          fontWeight:   600,
                          cursor:       selecting ? 'default' : 'pointer',
                          flexShrink:   0,
                          display:      'flex',
                          alignItems:   'center',
                          gap:          6,
                          opacity:      selecting && selecting !== folder.path ? 0.5 : 1,
                        }}
                      >
                        {selecting === folder.path
                          ? <><span className="dbx-spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.3)', width: 11, height: 11 }} />Reading…</>
                          : 'Select'}
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--fg-faint)' }}>›</span>
                    )}
                  </div>
                </li>
              );
            })}

            {files.map(file => (
              <li key={file.path}>
                <div style={{
                  display:    'flex',
                  alignItems: 'center',
                  gap:        10,
                  padding:    '6px 14px',
                  cursor:     'default',
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0, color: 'var(--fg-faint)' }}>📄</span>
                  <span style={{
                    flex:         1,
                    fontSize:     12,
                    color:        'var(--fg-subtle)',
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap',
                  }}>
                    {file.name}
                  </span>
                  {file.size !== undefined && (
                    <span style={{ fontSize: 11, color: 'var(--fg-faint)', flexShrink: 0 }}>
                      {formatSize(file.size)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <style>{`
        .dbx-spinner {
          display:       inline-block;
          width:         16px;
          height:        16px;
          border:        2px solid var(--border-default);
          border-top:    2px solid var(--brand-teal);
          border-radius: 50%;
          animation:     dbx-spin 0.7s linear infinite;
          flex-shrink:   0;
        }
        @keyframes dbx-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
