'use client';

import { useState } from 'react';
import { CircleCheck, CircleX, CloudUpload, FileText, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ToneChip } from '@/components/ui/tone-chip';
import { DropboxFileList } from '@/components/platform/shared/DropboxFileList';
import { Card, FileIcon, FileRowShell, formatBytes } from './parts';
import type { NeedFile, ProjectInfo } from './types';
import type { DealFiles } from './useDealFiles';

/** Drop zone + upload list (in-flight, failed, done), then the project's Dropbox folder when there is one. */
export function FilesCard({ files, project, canEdit, dealFiles, onRemove }: {
  files: NeedFile[];
  project: ProjectInfo | null;
  canEdit: boolean;
  dealFiles: DealFiles;
  onRemove: (f: NeedFile) => void;
}) {
  const { uploads, uploadMany, dismissUpload, viewFile, fileInputRef } = dealFiles;
  const [dragOver, setDragOver] = useState(false);
  const failedCount = uploads.filter(u => u.error).length;
  const inProgress = uploads.length - failedCount;
  const fileRows = uploads.length + files.length;

  return (
    <Card title="Files">
      <div className="flex flex-col gap-7 lg:flex-row">
        <div className="flex shrink-0 flex-col self-stretch rounded-[10px] border border-ui-divider bg-ui-page-bg p-6 lg:w-[280px]">
          <div
            onDragOver={e => { if (!canEdit) return; e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { if (!canEdit) return; e.preventDefault(); setDragOver(false); uploadMany(e.dataTransfer.files); }}
            className={cn(
              'flex min-h-[220px] flex-1 flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed p-6 text-center transition-colors',
              dragOver ? 'border-[var(--color-secondary-700)] bg-ui-selected-bg' : 'border-[var(--ui-input-border)] bg-ui-input-bg',
            )}
          >
            <CloudUpload size={32} strokeWidth={1.5} className="text-ui-body" aria-hidden />
            <p className="m-0 text-[14px] font-semibold leading-[1.45] text-ui-body">
              {canEdit ? 'Drag files here to upload' : 'Read-only'}
            </p>
            {canEdit && (
              <>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => uploadMany(e.target.files)} />
                <Button variant="outline" size="md" onClick={() => fileInputRef.current?.click()}>
                  Browse files
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex h-[356px] min-w-0 flex-1 flex-col gap-5 overflow-hidden rounded-[10px] border border-ui-divider bg-ui-page-bg p-6">
          <div className="flex items-start justify-between gap-3 leading-[1.45]">
            <p className="m-0 text-[13px] font-semibold text-ui-body">Uploads · {fileRows} file{fileRows === 1 ? '' : 's'}</p>
            {inProgress > 0 && <p className="m-0 text-[12px] text-ui-text-secondary">{inProgress} in progress</p>}
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {fileRows === 0 && (
              <EmptyState size="sm" icon={<FileText />} title="No files here yet." />
            )}
            {uploads.map(u => (
              <FileRowShell key={u.key}>
                {u.error ? (
                  <div className="flex items-center gap-3">
                    <CircleX size={22} strokeWidth={1.5} className="shrink-0 text-error-normal" aria-hidden />
                    <div className="flex min-w-0 flex-1 flex-col gap-1 leading-[1.45]">
                      <span className="truncate text-[13px] font-medium text-ui-body">{u.name}</span>
                      <span className="text-[12px] text-error-normal">{formatBytes(u.size)} · {u.error}</span>
                    </div>
                    <Button variant="outline-destructive" onClick={() => dismissUpload(u.key)}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-start gap-3">
                      <FileIcon name={u.name} />
                      <div className="flex min-w-0 flex-1 flex-col gap-[3px] leading-[1.45]">
                        <span className="truncate text-[13px] font-medium text-ui-body">{u.name}</span>
                        <span className="text-[12px] text-ui-text-secondary">{formatBytes(u.size)}</span>
                      </div>
                    </div>
                    <div className="relative h-1.5 w-full overflow-hidden rounded-[3px] bg-ui-hover-bg">
                      <div className="qv-indeterminate absolute top-0 h-1.5 w-[40%] rounded-[3px] bg-[var(--color-secondary-700)] dark:bg-ui-heading" />
                    </div>
                    <span className="text-[12px] leading-[1.45] text-ui-text-secondary">Uploading…</span>
                  </div>
                )}
              </FileRowShell>
            ))}
            {files.map(f => (
              <FileRowShell key={f.id}>
                <div className="flex items-center gap-3">
                  <FileIcon name={f.file_name} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1 leading-[1.45]">
                    <button type="button" onClick={() => viewFile(f)} title="Open file"
                      className="truncate border-0 bg-transparent p-0 text-left text-[13px] font-medium text-ui-body hover:underline">
                      {f.file_name}
                    </button>
                    <span className="text-[12px] text-ui-text-secondary">
                      {[f.uploaded_by_name, f.created_at ? new Date(f.created_at).toLocaleDateString('en-US') : null].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <ToneChip tone="t9" icon={CircleCheck}>Complete</ToneChip>
                  {canEdit && (
                    <button type="button" onClick={() => onRemove(f)} aria-label={`Remove ${f.file_name}`} title="Remove"
                      className="flex shrink-0 border-0 bg-transparent p-0 text-ui-text-secondary hover:text-error-normal">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </FileRowShell>
            ))}
          </div>
        </div>
      </div>
      {project?.dropbox_root_path && (
        <div className="mt-4">
          <DropboxFileList rootPath={project.dropbox_root_path} rootLabel={project.code} />
        </div>
      )}
    </Card>
  );
}
