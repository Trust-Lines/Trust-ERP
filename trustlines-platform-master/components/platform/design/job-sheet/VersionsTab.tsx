'use client';

import { useRef, useState } from 'react';
import { CheckCheck, Download, FileText, FolderPlus, RefreshCw, RotateCcw, Send, Upload } from 'lucide-react';
import type { SalesDesignVersion } from '@/types/database';
import type { DesignFile } from '@/app/(platform)/design/page';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/formatDate';
import { cn } from '@/lib/utils';
import { HEADING, VERSION_STATUSES, VERSION_STATUS_LABEL } from '../designShared';
import type { useJobVersions } from './useJobVersions';

type VersionActions = ReturnType<typeof useJobVersions>;

/**
 * Versions: designer → Sales → customer.
 * Designer: sync, new version, upload, send to Sales. Sales / manager: approve, request revision, send to customer.
 * Manager also gets a raw status picker. Sales downloads files once a version is approved.
 */
export function VersionsTab({ versions, designFiles, sales, isManager, actions }: {
  versions: SalesDesignVersion[];
  designFiles: Record<string, DesignFile[]>;
  sales: boolean;
  isManager: boolean;
  actions: VersionActions;
}) {
  const { busy } = actions;
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = useState<SalesDesignVersion | null>(null);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 max-w-[460px] text-[12px] text-ui-text-secondary">
          {sales
            ? 'Designs the designer sent you. Approve one (or ask for a revision); once approved you can send it to the customer and download its files.'
            : 'A version is a V1, V2… folder under Design proposal. The designer sends it to Sales; Sales approves it and sends the customer a review link.'}
        </p>
        {!sales && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void actions.syncVersions()} disabled={busy}><RefreshCw /> Sync from Dropbox</Button>
            <Button size="sm" onClick={actions.newVersion} disabled={busy}><FolderPlus /> New version</Button>
          </div>
        )}
      </div>
      <input ref={uploadRef} type="file" multiple hidden onChange={e => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; if (uploadFor) void actions.uploadToVersion(uploadFor, fs); }} />
      {versions.length === 0 ? (
        <div className="rounded-[8px] bg-ui-surface p-5">
          {sales
            ? <EmptyState icon={<FolderPlus />} title="Nothing to review yet" description="The designer has not sent a version to Sales yet." />
            : <EmptyState icon={<FolderPlus />} title="No versions yet" description="Create V1, upload the design into it, then send it to Sales." />}
        </div>
      ) : versions.map(v => {
        const files = designFiles[v.id] ?? [];
        const canSend = !sales && (v.status === 'draft' || v.status === 'revision_requested');
        const approved = v.status === 'approved' || v.status === 'presented';
        const reviewer = isManager || sales;
        return (
          <div key={v.id} className="flex flex-col gap-3 rounded-[8px] border border-ui-divider bg-ui-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('text-[15px] font-semibold', HEADING)}>V{v.version_no}</span>
              <StatusBadge group="design_version" status={v.status} size="sm" />
              <span className="text-[11px] text-ui-text-secondary">{formatDate(v.created_at)}{v.presented_at ? ` · sent ${formatDate(v.presented_at)}` : ''}</span>
              <div className="flex-1" />
              {!sales && <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setUploadFor(v); uploadRef.current?.click(); }}><Upload /> Upload</Button>}
              {canSend && <Button size="sm" disabled={busy || files.length === 0} title={files.length ? undefined : 'Upload the design first'} onClick={() => void actions.patchVersion(v, { status: 'submitted' }, 'Sent to Sales for review')}><Send /> Send to Sales</Button>}
              {reviewer && v.status === 'submitted' && (
                <>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => void actions.requestRevision(v)}><RotateCcw /> Request revision</Button>
                  <Button size="sm" disabled={busy} onClick={() => void actions.patchVersion(v, { status: 'approved' }, 'Design approved')}><CheckCheck /> Approve</Button>
                </>
              )}
              {reviewer && approved && (
                <Button size="sm" disabled={busy} onClick={() => void actions.sendToCustomer(v)}><Send /> {v.status === 'presented' ? 'New customer link' : 'Send to customer'}</Button>
              )}
              {isManager && (
                <Select aria-label={`V${v.version_no} status`} className="w-[140px]" value={v.status}
                  options={VERSION_STATUSES.map(s => ({ value: s, label: VERSION_STATUS_LABEL[s] }))}
                  onValueChange={s => { if (s && s !== v.status) void actions.patchVersion(v, { status: s }, 'Version updated'); }} />
              )}
            </div>
            {files.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {files.map(f => <Button key={f.id} variant="outline" size="sm" title={sales && approved ? 'Download' : 'Open'} onClick={() => void actions.openFile(f.id, 'design')}>{sales && approved ? <Download /> : <FileText />} {f.file_name}</Button>)}
              </div>
            ) : <p className="m-0 text-[12px] text-ui-text-secondary">No files in this version yet.</p>}
            {v.notes && v.notes !== 'Auto-synced from Dropbox' && <p className="m-0 text-[12px] text-ui-body">{v.notes}</p>}
            {v.customer_feedback && (
              <p className="m-0 rounded-[6px] bg-[var(--status-t7-bg)] px-3 py-2 text-[12px] text-[var(--status-t7-fg)]"><b>Customer feedback:</b> {v.customer_feedback}</p>
            )}
          </div>
        );
      })}
    </>
  );
}
