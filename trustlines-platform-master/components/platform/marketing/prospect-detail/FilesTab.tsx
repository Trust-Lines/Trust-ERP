'use client';

import type { RefObject } from 'react';
import { FileText, Paperclip, Trash2 } from 'lucide-react';
import type { ProspectFile } from './types';
import { FilesEmptyState } from '@/components/platform/shared/FilesEmptyState';

export function FilesTab({ files, canEdit, fileInputRef, uploadingFile, onUpload, onView, onDelete }: {
  files: ProspectFile[];
  canEdit?: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  uploadingFile: boolean;
  onUpload: (file: File) => void;
  onView: (dropboxPath: string) => void;
  onDelete: (fileId: string) => void;
}) {
  return (
    <div>
      {canEdit && (
        <div style={{ marginBottom: 12 }}>
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
          <button className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}>
            {uploadingFile ? 'Uploading…' : <><Paperclip size={13} /> Attach file</>}
          </button>
        </div>
      )}
      {files.length === 0 ? (
        <div className="card">
          <FilesEmptyState
            description="Keep briefs, photos and proposals for this lead together in one place."
            uploadLabel="Attach first file"
            onUpload={canEdit && !uploadingFile ? () => fileInputRef.current?.click() : undefined}
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {files.map(f => (
            <div key={f.id} className="card"><div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileText size={16} style={{ color: 'var(--fg-subtle)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file_name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)' }}>
                  {f.uploaded_by_name ?? 'Unknown'} · {new Date(f.created_at).toLocaleDateString('en-US')}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => onView(f.dropbox_path)}>View</button>
              {canEdit && (
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-danger)' }} onClick={() => onDelete(f.id)} title="Delete (temporary, dev-only)">
                  <Trash2 size={13} />
                </button>
              )}
            </div></div>
          ))}
        </div>
      )}
    </div>
  );
}
