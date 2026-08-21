'use client';

import { useState, useRef, useEffect } from 'react';
import { ExternalLink, Loader2, MoreHorizontal, Check, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { PermissionShield } from '@/components/platform/shared/PermissionShield';
import { FileUploadZone } from './FileUploadZone';
import type { DocumentRow } from './ProjectDetailClient';

interface Props {
  documents:       DocumentRow[];
  userRole:        string;
  projectId:       string;
  projectCode:     string;
  dropboxRootPath: string | null;
  onRefresh:       () => void;
}

interface FolderGroup { label: string; key: string; phase: number; color: string }

const FOLDER_GROUPS: FolderGroup[] = [
  { label: 'Finalization',           key: '1-Finalization',          phase: 1, color: 'var(--phase-1)' },
  { label: 'Construction Documents', key: '2-Construction Document', phase: 2, color: 'var(--phase-2)' },
  { label: 'Production & Delivery',  key: '3-Production & Delivery', phase: 3, color: 'var(--phase-3)' },
  { label: 'Missing / Extra',        key: '0-Missing-Extra',         phase: 3, color: 'var(--fg-subtle)' },
];

function getGroup(path: string): FolderGroup {
  for (const g of FOLDER_GROUPS) {
    if (path.includes(`/${g.key}`) || path.includes(`\\${g.key}`)) return g;
  }
  return { label: 'Other', key: 'other', phase: 0, color: 'var(--fg-subtle)' };
}

function FileBadge({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const MAP: Record<string, { label: string; bg: string; color: string }> = {
    pdf:  { label: 'PDF', bg: 'var(--status-danger-bg)', color: 'var(--status-danger)' },
    dwg:  { label: 'DWG', bg: 'var(--status-info-bg)', color: 'var(--status-info)' },
    dxf:  { label: 'DXF', bg: 'var(--status-info-bg)', color: 'var(--status-info)' },
    xls:  { label: 'XLS', bg: 'var(--status-success-bg)', color: 'var(--status-success)' },
    xlsx: { label: 'XLS', bg: 'var(--status-success-bg)', color: 'var(--status-success)' },
    doc:  { label: 'DOC', bg: 'var(--status-info-bg)', color: 'var(--status-info)' },
    docx: { label: 'DOC', bg: 'var(--status-info-bg)', color: 'var(--status-info)' },
    jpg:  { label: 'IMG', bg: 'var(--status-warning-bg)', color: 'var(--status-warning)' },
    png:  { label: 'IMG', bg: 'var(--status-warning-bg)', color: 'var(--status-warning)' },
  };
  const { label, bg, color } = MAP[ext] ?? { label: ext.toUpperCase().slice(0, 3) || 'FIL', bg: 'var(--bg-sunken)', color: 'var(--fg-subtle)' };
  return (
    <div style={{ width: 32, height: 32, borderRadius: 5, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color, letterSpacing: '0.03em', flexShrink: 0 }}>
      {label}
    </div>
  );
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft:            { bg: 'var(--status-warning-bg)', color: 'var(--status-warning)' },
  pending_approval: { bg: 'var(--status-info-bg)', color: 'var(--status-info)' },
  approved:         { bg: 'var(--status-success-bg)', color: 'var(--status-success)' },
  rejected:         { bg: 'var(--status-danger-bg)', color: 'var(--status-danger)' },
  signed:           { bg: 'var(--phase-5-bg)', color: 'var(--phase-5)' },
  revised:          { bg: 'var(--status-warning-bg)', color: 'var(--status-warning)' },
};
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: 'var(--bg-sunken)', color: 'var(--fg-subtle)' };
  return (
    <span style={{ padding: '2px 7px', borderRadius: 3, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {status.replace('_', ' ')}
    </span>
  );
}

function ViewBtn({ docId }: { docId: string }) {
  const [loading, setLoading] = useState(false);
  async function open() {
    setLoading(true);
    try {
      const res  = await fetch(`/api/files/view?documentId=${docId}`);
      if (!res.ok) throw new Error();
      const { link } = await res.json() as { link: string };
      window.open(link, '_blank');
    } catch { alert('Could not open file'); }
    finally { setLoading(false); }
  }
  return (
    <button onClick={open} disabled={loading} title="View in Dropbox"
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: 'var(--fg-subtle)', display: 'flex', alignItems: 'center', lineHeight: 0 }}>
      {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <ExternalLink size={13} />}
    </button>
  );
}

function OverflowMenu({ doc, onRefresh }: { doc: DocumentRow; onRefresh: () => void }) {
  const [open, setOpen]   = useState(false);
  const [busy, setBusy]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const isProposal = doc.doc_type === 'proposal';
  const isApproved = doc.status === 'approved';

  async function markApproved() {
    setBusy(true);
    try {
      const res = await fetch(`/api/files/${doc.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      if (!res.ok) throw new Error((await res.json() as { error: string }).error);
      toast.success('Design Proposal marked as client approved');
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    } finally { setBusy(false); setOpen(false); }
  }

  if (!isProposal) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="More options"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: 'var(--fg-subtle)', display: 'flex', alignItems: 'center', lineHeight: 0 }}
      >
        <MoreHorizontal size={13} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', zIndex: 50,
          background: 'white', border: '1px solid var(--border-default)',
          borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
          minWidth: 200, padding: '4px 0',
        }}>
          <button
            disabled={isApproved || busy}
            onClick={markApproved}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', background: 'none', border: 'none',
              fontSize: 13, cursor: isApproved ? 'default' : 'pointer',
              color: isApproved ? 'var(--fg-faint)' : 'var(--fg-default)',
              textAlign: 'left',
            }}
          >
            <Check size={13} color={isApproved ? 'var(--status-success)' : 'var(--fg-subtle)'} />
            {isApproved ? 'Client approved ✓' : busy ? 'Saving…' : 'Mark as client approved'}
          </button>
        </div>
      )}
    </div>
  );
}

function SyncDot({ synced }: { synced: boolean }) {
  return (
    <span title={synced ? 'Synced to Dropbox' : 'Not synced'}
      style={{ fontSize: 14, color: synced ? 'var(--brand-teal)' : 'var(--border-default)' }}>
      ☁
    </span>
  );
}

export function DocumentTable({ documents, userRole, projectId, projectCode, dropboxRootPath, onRefresh }: Props) {
  const [showUpload, setShowUpload] = useState(false);
  const isPF    = (d: DocumentRow) => d.doc_type === 'pf';
  const hidePF  = userRole === 'tlines_pm';
  const canUpload = !['accounting', 'logistics'].includes(userRole);

  const visible = hidePF ? documents.filter(d => !isPF(d)) : documents;
  const pfCount = hidePF ? documents.filter(d => isPF(d)).length : 0;

  const groupMap = new Map<string, { group: FolderGroup; docs: DocumentRow[] }>();
  const ungrouped: DocumentRow[] = [];

  for (const doc of visible) {
    const g = getGroup(doc.dropbox_path ?? '');
    if (!groupMap.has(g.key)) groupMap.set(g.key, { group: g, docs: [] });
    groupMap.get(g.key)!.docs.push(doc);
  }
  const allGroups = [...groupMap.values()].sort((a, b) => a.group.phase - b.group.phase);

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div>
            <div className="text-eyebrow">{visible.length} file{visible.length !== 1 ? 's' : ''} · Dropbox synced</div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Documents</h3>
          </div>
          {canUpload && (
            <button
              onClick={() => setShowUpload(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--fg-default)', fontFamily: 'var(--font-ui)' }}
            >
              <Upload size={12} /> Upload
            </button>
          )}
        </div>

        {visible.length === 0 && pfCount === 0 ? (
          <div className="card-body" style={{ textAlign: 'center', padding: '32px 18px', color: 'var(--fg-faint)', fontSize: 13 }}>
            No documents uploaded yet
          </div>
        ) : (
          <div>
            {allGroups.map(({ group, docs }) => (
              <div key={group.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 18px', background: 'var(--bg-subtle)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: group.color }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: group.color, display: 'inline-block' }} />
                  {group.label}
                </div>
                {docs.map((doc, i) => (
                  <div
                    key={doc.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: i < docs.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                  >
                    <FileBadge name={doc.file_name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-default)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {doc.file_name}
                        </span>
                        {doc.doc_type === 'pf' && (
                          <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--brand-navy)', color: 'white', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>INTERNAL</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 2 }}>
                        {doc.file_size_bytes ? `${(doc.file_size_bytes / 1024).toFixed(0)} KB · ` : ''}
                        {new Date(doc.uploaded_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                      V{doc.dropbox_version ?? doc.version}
                    </span>
                    <StatusBadge status={doc.status} />
                    <SyncDot synced={!!doc.dropbox_file_id} />
                    <ViewBtn docId={doc.id} />
                    <OverflowMenu doc={doc} onRefresh={onRefresh} />
                  </div>
                ))}
              </div>
            ))}

            {hidePF && pfCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)', fontSize: 12, color: 'var(--fg-subtle)' }}>
                <PermissionShield label={`${pfCount} PF document${pfCount > 1 ? 's' : ''} — internal only`} />
              </div>
            )}
          </div>
        )}
      </div>

      {showUpload && (
        <FileUploadZone
          projectId={projectId}
          projectCode={projectCode}
          dropboxRootPath={dropboxRootPath}
          userRole={userRole}
          onSuccess={onRefresh}
          onClose={() => setShowUpload(false)}
        />
      )}
    </>
  );
}
