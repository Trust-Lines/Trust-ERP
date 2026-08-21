'use client';

import { useState } from 'react';
import { ExternalLink, Loader2, Download } from 'lucide-react';
import type { DocType, DocStatus } from '@/types/database';

export interface DocumentRow {
  id: string;
  doc_type: DocType;
  version: number;
  status: DocStatus;
  dropbox_path: string;
  file_name: string;
  uploaded_at: string;
  branch: 'ms' | 'ci' | 'combined' | null;
  notes: string | null;
  uploader: { full_name: string } | null;
}

interface DocumentsTableProps {
  documents: DocumentRow[];
  userRole: string;
  onUpload: () => void;
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const cfg: Record<string, { label: string; bg: string; color: string }> = {
    pdf:  { label: 'PDF', bg: 'var(--status-danger-bg)', color: 'var(--status-danger)' },
    dwg:  { label: 'DWG', bg: 'var(--status-info-bg)', color: 'var(--status-info)' },
    dxf:  { label: 'DXF', bg: 'var(--status-info-bg)', color: 'var(--status-info)' },
    xls:  { label: 'XLS', bg: 'var(--status-success-bg)', color: 'var(--status-success)' },
    xlsx: { label: 'XLS', bg: 'var(--status-success-bg)', color: 'var(--status-success)' },
    doc:  { label: 'DOC', bg: 'var(--status-info-bg)', color: 'var(--status-info)' },
    docx: { label: 'DOC', bg: 'var(--status-info-bg)', color: 'var(--status-info)' },
    jpg:  { label: 'IMG', bg: 'var(--status-warning-bg)', color: 'var(--status-warning)' },
    jpeg: { label: 'IMG', bg: 'var(--status-warning-bg)', color: 'var(--status-warning)' },
    png:  { label: 'IMG', bg: 'var(--status-warning-bg)', color: 'var(--status-warning)' },
  };
  const { label, bg, color } = cfg[ext] ?? { label: ext.toUpperCase().slice(0, 3) || 'FILE', bg: 'var(--bg-sunken)', color: 'var(--fg-subtle)' };
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 6, background: bg, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 9, fontWeight: 800, color, letterSpacing: '0.04em',
    }}>
      {label}
    </div>
  );
}

const STATUS_STYLES: Record<DocStatus, { bg: string; color: string; border: string }> = {
  draft:            { bg: 'var(--bg-sunken)', color: 'var(--fg-muted)', border: 'var(--border-default)' },
  pending_approval: { bg: 'var(--status-warning-bg)', color: 'var(--status-warning)', border: 'var(--status-warning)' },
  approved:         { bg: 'var(--status-success-bg)', color: 'var(--status-success)', border: 'var(--status-success)' },
  signed:           { bg: 'var(--phase-5-bg)', color: 'var(--phase-5)', border: 'var(--phase-5)' },
  rejected:         { bg: 'var(--status-danger-bg)', color: 'var(--status-danger)', border: 'var(--status-danger)' },
  revised:          { bg: 'var(--status-warning-bg)', color: 'var(--status-warning)', border: 'var(--status-warning)' },
};

function StatusPill({ status }: { status: DocStatus }) {
  const { bg, color, border } = STATUS_STYLES[status];
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
      background: bg, color, border: `1px solid ${border}`,
      textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
    }}>
      {status.replace('_', ' ')}
    </span>
  );
}

function ActionBtn({ documentId }: { documentId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleView() {
    setLoading(true);
    try {
      const res = await fetch(`/api/files/view?documentId=${documentId}`);
      if (!res.ok) throw new Error('Cannot open');
      const { link } = await res.json() as { link: string };
      window.open(link, '_blank');
    } catch { alert('Could not open file'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button
        onClick={handleView} disabled={loading}
        title="Open in Dropbox"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 4, color: 'var(--fg-subtle)', lineHeight: 0, display: 'flex', alignItems: 'center' }}
      >
        {loading
          ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          : <ExternalLink size={14} />}
      </button>
      <button
        onClick={handleView}
        title="Download"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 4, color: 'var(--fg-subtle)', lineHeight: 0, display: 'flex', alignItems: 'center' }}
      >
        <Download size={14} />
      </button>
    </div>
  );
}

interface PhaseGroup { label: string; phaseNum: number; color: string; types: DocType[] }

const PHASE_GROUPS: PhaseGroup[] = [
  { label: 'Finalization',          phaseNum: 1, color: 'var(--phase-1)', types: ['closed_deal_email','plan_layout','proposal','shop_drawing'] },
  { label: 'Construction Documents',phaseNum: 2, color: 'var(--phase-2)', types: ['construction_drawings','item_plan','item_list','price_list','book','boq'] },
  { label: 'PO / BO',               phaseNum: 3, color: 'var(--phase-3)', types: ['po_bo'] },
  { label: 'PF',                     phaseNum: 4, color: 'var(--phase-4)', types: ['pf'] },
  { label: 'Production & QC',       phaseNum: 5, color: 'var(--phase-5)', types: ['qc_checklist','packing_list'] },
  { label: 'Delivery',              phaseNum: 6, color: 'var(--phase-6)', types: ['shipment_doc','delivery_confirm'] },
];

const DOC_LABELS: Partial<Record<DocType, string>> = {
  closed_deal_email:     'Closed Deal Email',
  plan_layout:           'Plan Layout',
  proposal:              'Proposal',
  shop_drawing:          'Shop Drawing',
  construction_drawings: 'Construction Drawings',
  item_plan:             'Item Plan',
  item_list:             'Item List',
  boq:                   'Bill of Quantities',
  book:                  'Book',
  price_list:            'Price List',
  po_bo:                 'PO / BO',
  pf:                    'Proforma Invoice',
  qc_checklist:          'QC Checklist',
  packing_list:          'Packing List',
  shipment_doc:          'Shipment Document',
  delivery_confirm:      'Delivery Confirmation',
};

function fmtSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentsTable({ documents, userRole, onUpload }: DocumentsTableProps) {
  const hidePF = userRole === 'tlines_pm';
  const canUpload = !['tlines_pm','accounting','logistics'].includes(userRole) || userRole === 'logistics';

  const visibleGroups = PHASE_GROUPS.filter(g => !(hidePF && g.phaseNum === 4));
  const docsWithFile  = documents.filter(d => visibleGroups.flatMap(g => g.types).includes(d.doc_type));

  return (
    <div style={{ background: 'white', border: '1px solid var(--border-subtle)', borderRadius: 8, marginTop: 16, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--fg-faint)', marginBottom: 2 }}>
            {docsWithFile.length} file{docsWithFile.length !== 1 ? 's' : ''} · Dropbox synced
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-default)' }}>Documents</div>
        </div>
        {canUpload && (
          <button
            onClick={onUpload}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 6,
              border: '1px solid var(--border-default)', background: 'white',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--fg-default)',
              fontFamily: 'var(--font-ui)',
            }}
          >
            ↑ Upload
          </button>
        )}
      </div>

      {docsWithFile.length === 0 ? (
        <div style={{ padding: '32px 18px', textAlign: 'center', fontSize: 13, color: 'var(--fg-faint)' }}>
          No documents uploaded yet
        </div>
      ) : (
        <div>
          {visibleGroups.map(group => {
            const groupDocs = docsWithFile.filter(d => group.types.includes(d.doc_type));
            if (groupDocs.length === 0) return null;

            return (
              <div key={group.phaseNum}>
                <div style={{
                  padding: '7px 18px', fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: group.color, background: 'var(--bg-subtle)',
                  borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: group.color, display: 'inline-block' }} />
                  {group.label}
                </div>

                {groupDocs.map((doc, i) => (
                  <div
                    key={doc.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 18px',
                      borderBottom: i < groupDocs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    <FileIcon name={doc.file_name} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-default)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {doc.file_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 1 }}>
                        {DOC_LABELS[doc.doc_type] ?? doc.doc_type}
                        {doc.branch && (
                          <span style={{ marginLeft: 6, padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 700, background: doc.branch === 'ms' ? 'var(--brand-teal-100)' : 'var(--brand-orange-100)', color: doc.branch === 'ms' ? 'var(--brand-teal-600)' : 'var(--brand-orange-600)' }}>
                            {doc.branch.toUpperCase()}
                          </span>
                        )}
                        {' · '}{doc.uploader?.full_name?.split(' ')[0] ?? '—'}
                        {' · '}{new Date(doc.uploaded_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>

                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                      v{doc.version}
                    </span>

                    <StatusPill status={doc.status} />

                    <ActionBtn documentId={doc.id} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
