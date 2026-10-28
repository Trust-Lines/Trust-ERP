'use client';

import { useRef, useState } from 'react';
import { FileText, FolderOpen, Image as ImageIcon, Loader2, Upload } from 'lucide-react';
import { StepFooter } from './StepFooter';
import type { DocRow, StepProps } from './types';
import { cn } from '@/lib/utils';

const ACCEPT = '.pdf,.dwg,.png,.jpg,.jpeg';

// Figma "New lead · Dimensions & media" (node 290:37695): 360 link field, then a file surface —
// empty state ("Drop files or plans to upload" + "Upload first file") until something is attached.
export function Step6DimensionsMedia({ form, setForm, onBack, onNext, onSaveDraft, documents, uploading, onUpload }: StepProps & {
  documents: DocRow[];
  /** Names of files currently uploading. */
  uploading: string[];
  onUpload: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const files = documents.filter(d => d.category === 'plan_layout' || d.category === 'photos');
  const empty = files.length === 0 && uploading.length === 0;

  function pick(list: FileList | null) {
    if (list?.length) onUpload(Array.from(list));
    if (inputRef.current) inputRef.current.value = '';
  }

  const uploadBtn = (label: string) => (
    <button
      type="button" onClick={() => inputRef.current?.click()}
      className="inline-flex h-9 items-center gap-[7px] rounded-[6px] border-0 bg-[var(--color-secondary-700)] px-3.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 dark:bg-primary-50 dark:text-primary-950"
    >
      <Upload size={16} aria-hidden /> {label}
    </button>
  );

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div>
        <h2 className="m-0 text-[20px] font-semibold leading-[1.45] text-[var(--color-secondary-700)] dark:text-ui-heading">Dimensions & media</h2>
        <p className="mt-1 text-[13px] text-ui-body">Attach Matterport 360 link and initial site files.</p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-[7px]">
          <label htmlFor="intake-matterport" className="text-[12px] font-medium leading-4 text-ui-body">Matterport 360 Virtual Tour Link</label>
          <input
            id="intake-matterport" type="url" placeholder="https://..."
            value={form.matterport_link}
            onChange={e => setForm(f => ({ ...f, matterport_link: e.target.value }))}
            className="min-h-[42px] w-full rounded-[6px] border border-ui-divider bg-ui-input-bg px-3 py-3 text-[14px] leading-[1.4] text-ui-heading outline-none placeholder:text-ui-body focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
          />
        </div>

        <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={e => pick(e.target.files)} />
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files); }}
          className={cn(
            'min-h-[346px] rounded-[10px] border p-6 transition-colors',
            dragOver ? 'border-[var(--color-secondary-700)] bg-ui-selected-bg dark:border-ui-heading' : 'border-ui-divider bg-ui-input-bg',
          )}
        >
          {empty ? (
            <div className="flex min-h-[298px] flex-col items-center justify-center gap-[18px] text-center">
              <span aria-hidden className="grid place-items-center rounded-[12px] bg-ui-surface p-4 text-ui-body">
                <FolderOpen size={32} strokeWidth={1.5} />
              </span>
              <p className="m-0 text-[20px] font-semibold leading-[1.45] text-ui-body">Drop files or plans to upload</p>
              {uploadBtn('Upload first file')}
              <p className="m-0 text-[12px] leading-[1.45] text-ui-text-secondary">PDF, DWG, PNG, or JPG · Up to 50 MB</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="m-0 text-[13px] font-semibold text-ui-body">
                  {files.length} file{files.length === 1 ? '' : 's'} attached
                  {uploading.length > 0 && <span className="font-normal text-ui-text-secondary"> · {uploading.length} uploading</span>}
                </p>
                {uploadBtn('Upload more')}
              </div>
              <ul className="m-0 flex list-none flex-col divide-y divide-ui-divider p-0">
                {uploading.map(name => (
                  <li key={`up-${name}`} className="flex items-center gap-3 py-3 text-[13px] text-ui-body">
                    <Loader2 size={18} className="shrink-0 animate-spin text-ui-text-secondary" aria-hidden />
                    <span className="truncate">{name}</span>
                    <span className="ml-auto shrink-0 text-[12px] text-ui-text-secondary">Uploading…</span>
                  </li>
                ))}
                {files.map(d => {
                  const Icon = d.category === 'photos' ? ImageIcon : FileText;
                  return (
                    <li key={d.id} className="flex items-center gap-3 py-3 text-[13px] text-ui-body">
                      <Icon size={18} strokeWidth={1.5} className="shrink-0" aria-hidden />
                      <span className="truncate font-medium">{d.file_name}</span>
                      <span className="ml-auto shrink-0 rounded-[4px] bg-[var(--status-t0-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--status-t0-fg)]">
                        {d.category === 'photos' ? 'Photo' : 'Plan'}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="m-0 text-[12px] text-ui-text-secondary">Drop more files here · PDF, DWG, PNG, or JPG · Up to 50 MB</p>
            </div>
          )}
        </div>
      </div>

      <StepFooter onBack={onBack} onNext={onNext} onSaveDraft={onSaveDraft} />
    </div>
  );
}
