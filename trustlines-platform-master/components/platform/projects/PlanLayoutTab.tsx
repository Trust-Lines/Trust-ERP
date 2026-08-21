'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Download, ExternalLink, ZoomIn, ZoomOut, Maximize2,
  CheckCircle2, Clock, XCircle, ThumbsDown, Loader2,
  FilePlus2, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import type { DocumentRow, AuditRow } from './ProjectDetailClient';
import { DropboxSyncBtn } from './ProjectWorkflow';
import { ApprovalActionBar } from '../approvals/ApprovalActionBar';
import { approvalStagesFor, signPermForStage } from '@/lib/approvals/stageConfig';
import { permCan, type PermMap } from '@/lib/permissions/catalog';
import dynamic from 'next/dynamic';

const DocGeneratorModal = dynamic(() => import('./DocGeneratorModal'), { ssr: false });
const SignaturePad      = dynamic(() => import('../SignaturePad').then(m => ({ default: m.SignaturePad })), { ssr: false });

interface ApprovalRow {
  id:          string;
  stage:       number;
  status:      string;
  assigned_to: string | null;
  approved_by: string | null;
  notes:       string | null;
  created_at:  string;
  resolved_at: string | null;
  version_num: number | null;
}

function DropboxIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.85} viewBox="0 0 24 20" fill="#0061FF">
      <path d="M6 0L0 4l6 4 6-4L6 0zm12 0l-6 4 6 4 6-4-6-4zM0 12l6 4 6-4-6-4-6 4zm18-4l-6 4 6 4 6-4-6-4zM6 17l6 3 6-3-6-4-6 4z" />
    </svg>
  );
}

function DocStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, [string, string, string]> = {
    approved:         ['var(--status-success-bg)', 'var(--status-success)', 'Approved'],
    rejected:         ['var(--status-danger-bg)', 'var(--status-danger)', 'Rejected'],
    pending_approval: ['var(--status-warning-bg)', 'var(--status-warning)', 'Pending Review'],
    draft:            ['var(--bg-sunken)', 'var(--fg-muted)', 'Draft'],
    revised:          ['var(--phase-5-bg)', 'var(--phase-5)', 'Revised'],
    signed:           ['var(--status-info-bg)', 'var(--status-info)', 'Signed'],
  };
  const [bg, color, label] = cfg[status] ?? cfg.draft;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 99,
      fontSize: 10, fontWeight: 700, background: bg, color,
    }}>
      {label}
    </span>
  );
}

const toolBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 5, border: '1px solid var(--border-default)',
  background: 'white', cursor: 'pointer', color: 'var(--fg-muted)',
};

const PROD_DOC_TYPES_WITH_APPROVAL = ['proposal', 'item_plan', 'item_list', 'price_list', 'book', 'po_bo', 'pf'];

function getApprovalStages(docType: string, catGroup?: string | null) {
  return approvalStagesFor(docType, catGroup ?? null).map(s => ({ label: s.label, hint: s.hint }));
}

function ApprovalStage({
  index, label, hint, approval, isLast, userId, projectId,
  onRefresh, onSynced, onApproveOptimistic, userSignature, onNeedSignature, onPdfSigned, canSignByRole,
}: {
  index:                number;
  label:                string;
  hint:                 string;
  approval:             ApprovalRow | null;
  isLast:               boolean;
  userId:               string;
  projectId:            string;
  onRefresh:            () => void;
  onSynced?:            () => void;
  onPdfSigned?:         () => void;
  onApproveOptimistic?: (stageIndex: number, action: 'approve' | 'reject') => void;
  userSignature?:       string | null;
  onNeedSignature?:     (onDone: () => void) => void;
  canSignByRole?:       boolean;
}) {
  const status     = approval?.status ?? 'waiting';
  const resolvedAt = approval?.resolved_at ?? null;
  const isMyTurn   = status === 'pending' && (approval?.assigned_to === userId || !!canSignByRole);

  const icon = status === 'approved'
    ? <CheckCircle2 size={13} color="var(--status-success)" />
    : status === 'rejected'
      ? <XCircle size={13} color="var(--status-danger)" />
      : status === 'pending'
        ? <Clock size={13} color="var(--status-warning)" />
        : <Clock size={13} color="var(--fg-subtle)" />;

  const circleBg = status === 'approved' ? 'var(--status-success-bg)'
    : status === 'rejected' ? 'var(--status-danger-bg)'
    : status === 'pending'  ? 'var(--status-warning-bg)'
    : 'var(--bg-sunken)';

  const circleBorder = status === 'approved' ? 'var(--status-success)'
    : status === 'rejected' ? 'var(--status-danger)'
    : status === 'pending'  ? 'var(--status-warning)'
    : 'var(--border-default)';

  const badgeBg     = status === 'approved' ? 'var(--status-success-bg)' : status === 'rejected' ? 'var(--status-danger-bg)' : status === 'pending' ? 'var(--status-warning-bg)' : 'var(--bg-sunken)';
  const badgeColor  = status === 'approved' ? 'var(--status-success)' : status === 'rejected' ? 'var(--status-danger)' : status === 'pending' ? 'var(--status-warning)' : 'var(--fg-subtle)';
  const badgeLabel  = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : status === 'pending' ? 'Pending' : 'Waiting';

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: circleBg, border: `2px solid ${circleBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        {!isLast && (
          <div style={{ width: 2, flex: 1, minHeight: 28, background: 'var(--border-default)', margin: '4px 0' }} />
        )}
      </div>

      <div style={{ paddingBottom: isLast ? 0 : 20, flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-default)', marginBottom: 1 }}>
          {index + 1}. {label}
        </div>
        <div style={{ fontSize: 10, color: 'var(--fg-faint)', marginBottom: 5 }}>{hint}</div>
        <span style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: 99,
          fontSize: 10, fontWeight: 700, background: badgeBg, color: badgeColor,
          marginBottom: status === 'approved' || status === 'rejected' ? 3 : 6,
        }}>
          {badgeLabel}
        </span>

        {status === 'approved' && resolvedAt && (
          <div style={{ fontSize: 10, color: 'var(--fg-faint)' }}>
            {new Date(resolvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {approval?.version_num != null && (
              <span style={{ marginLeft: 6, fontWeight: 700, color: 'var(--status-success)' }}>V{approval.version_num}</span>
            )}
          </div>
        )}
        {status === 'rejected' && approval?.notes && (
          <div style={{ fontSize: 10, color: 'var(--status-danger)', marginTop: 2 }}>{approval.notes}</div>
        )}
        {status === 'pending' && !isMyTurn && (
          <div style={{ fontSize: 10, color: 'var(--fg-faint)' }}>Waiting for your team to review</div>
        )}
        {status === 'waiting' && (
          <div style={{ fontSize: 10, color: 'var(--fg-faint)' }}>Will activate after Stage 1 is approved</div>
        )}

        {isMyTurn && approval && (
          <ApprovalActionBar
            approvalId={approval.id}
            projectId={projectId}
            isFinalStage={isLast}
            versionNum={approval.version_num}
            userSignature={userSignature}
            onNeedSignature={onNeedSignature}
            onApproveOptimistic={() => onApproveOptimistic?.(index, 'approve')}
            onPdfSigned={onPdfSigned}
            onSynced={onSynced}
            onDone={onRefresh}
          />
        )}
      </div>
    </div>
  );
}

function RoleApprovalFallback({
  projectId, documentId, docStatus: initialDocStatus,
  userId, trustlinesPmId, tlinesPmId, onDone, onFullyApproved,
}: {
  projectId:        string;
  documentId:       string;
  docType:          string;
  versionNum:       number;
  docStatus:        string;
  userId:           string;
  trustlinesPmId:   string | null;
  tlinesPmId:       string | null;
  onDone:           () => void;
  onFullyApproved?: () => void;
}) {
  const [docStatus, setDocStatus]         = useState(initialDocStatus);
  const [acting, setActing]               = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [rejectedByStage, setRejectedByStage] = useState<1 | 2 | null>(null);

  const isTrustPm  = userId === trustlinesPmId;
  const isClientPm = userId === tlinesPmId;

  const stage1Status: 'pending' | 'approved' | 'rejected' =
    rejectedByStage === 1 ? 'rejected'
    : (docStatus === 'draft' || docStatus === 'revised' || docStatus === 'rejected') && !rejectedByStage ? 'pending'
    : (docStatus === 'rejected' && rejectedByStage === null) ? 'pending'
    : (docStatus === 'draft' || docStatus === 'revised') ? 'pending'
    : 'approved';
  const stage2Status: 'waiting' | 'pending' | 'approved' | 'rejected' =
    rejectedByStage === 2 ? 'rejected'
    : docStatus === 'approved' ? 'approved'
    : docStatus === 'pending_approval' ? 'pending'
    : 'waiting';

  async function resetApproval() {
    setActing(true);
    setError(null);
    setDocStatus('draft');
    try {
      const res = await fetch(`/api/projects/${projectId}/documents/${documentId}/approve`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reset: true }) });
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error ?? 'Failed'); }
      onDone();
    } catch (e) {
      setDocStatus(initialDocStatus);
      setError(e instanceof Error ? e.message : 'Error');
    } finally { setActing(false); }
  }

  async function approveStage(stage: 1 | 2) {
    setActing(true);
    setError(null);
    const optimisticStatus = stage === 1 ? 'pending_approval' : 'approved';
    const previousStatus   = docStatus;
    setDocStatus(optimisticStatus);
    try {
      const res = await fetch(`/api/projects/${projectId}/documents/${documentId}/approve`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage }) });
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error ?? 'Failed'); }
      onDone();
      onFullyApproved?.();
    } catch (e) {
      setDocStatus(previousStatus);
      setError(e instanceof Error ? e.message : 'Error');
    } finally { setActing(false); }
  }

  async function rejectStage(stage: 1 | 2, notes?: string) {
    setActing(true);
    setError(null);
    const previousStatus = docStatus;
    setDocStatus('rejected');
    setRejectedByStage(stage);
    try {
      const res = await fetch(`/api/projects/${projectId}/documents/${documentId}/approve`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reject: true, stage, notes }) });
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error ?? 'Failed'); }
      onDone();
      onFullyApproved?.();
    } catch (e) {
      setDocStatus(previousStatus);
      setRejectedByStage(null);
      setError(e instanceof Error ? e.message : 'Error');
    } finally { setActing(false); }
  }

  function StageRow({ num, label, hint, status, canAct }: {
    num: 1 | 2; label: string; hint: string;
    status: 'waiting' | 'pending' | 'approved' | 'rejected'; canAct: boolean;
  }) {
    const [rejecting, setRejecting] = useState(false);
    const [rejectNote, setRejectNote] = useState('');

    const cfg = {
      waiting:  { bg: 'var(--bg-sunken)', color: 'var(--fg-subtle)', text: 'Waiting' },
      pending:  { bg: 'var(--status-warning-bg)', color: 'var(--status-warning)', text: 'Pending' },
      approved: { bg: 'var(--status-success-bg)', color: 'var(--status-success)', text: '✓ Approved' },
      rejected: { bg: 'var(--status-danger-bg)', color: 'var(--status-danger)', text: '✗ Rejected' },
    }[status];

    return (
      <div style={{ display: 'flex', gap: 10, paddingBottom: num === 1 ? 14 : 0, borderBottom: num === 1 ? '1px solid var(--border-subtle)' : 'none', marginBottom: num === 1 ? 14 : 0 }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 1,
          background: cfg.bg, border: `2px solid ${cfg.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 900, color: cfg.color,
        }}>{num}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-default)', marginBottom: 1 }}>{label}</div>
          <div style={{ fontSize: 10, color: 'var(--fg-faint)', marginBottom: 6 }}>{hint}</div>
          <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: cfg.bg, color: cfg.color, marginBottom: canAct ? 8 : 0 }}>
            {cfg.text}
          </span>
          {canAct && !rejecting && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => approveStage(num)}
                disabled={acting}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 14px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                  background: 'var(--status-success)', color: 'white', border: 'none',
                  cursor: acting ? 'default' : 'pointer', opacity: acting ? 0.7 : 1,
                }}
              >
                {acting ? <><Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />Approving…</> : '✓ Approve'}
              </button>
              <button
                onClick={() => setRejecting(true)}
                disabled={acting}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                  background: 'var(--status-danger-bg)', color: 'var(--status-danger)', border: '1px solid var(--status-danger)',
                  cursor: 'pointer',
                }}
              >
                <ThumbsDown size={10} /> Reject
              </button>
            </div>
          )}
          {canAct && rejecting && (
            <div style={{ marginTop: 4 }}>
              <textarea
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder="Reason for rejection (required)"
                rows={2}
                style={{
                  width: '100%', fontSize: 11, padding: '5px 8px',
                  border: `1px solid ${rejectNote.trim() ? 'var(--border-default)' : 'var(--status-danger)'}`,
                  borderRadius: 5, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 5, marginTop: 5, alignItems: 'center' }}>
                <button
                  onClick={() => { void rejectStage(num, rejectNote.trim()); setRejecting(false); }}
                  disabled={acting || !rejectNote.trim()}
                  style={{
                    padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 600,
                    background: rejectNote.trim() ? 'var(--status-danger)' : 'var(--status-danger)', color: 'white', border: 'none',
                    cursor: rejectNote.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Confirm Reject
                </button>
                <button
                  onClick={() => setRejecting(false)}
                  style={{ padding: '4px 8px', borderRadius: 5, fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-subtle)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '14px 16px' }}>
      {docStatus === 'rejected' && (
        <div style={{
          background: 'var(--status-danger-bg)', border: '1px solid var(--status-danger)', borderRadius: 7,
          padding: '10px 14px', marginBottom: 12,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <XCircle size={14} color="var(--status-danger)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--status-danger)', marginBottom: 2 }}>
              Revision Required
            </div>
            <div style={{ fontSize: 11, color: 'var(--status-danger-fg)', lineHeight: 1.5 }}>
              This version has been rejected. Click the <strong>Edit</strong> button on the file to revise and resubmit for approval.
            </div>
          </div>
        </div>
      )}
      <StageRow num={1} label="Trust PM Review"    hint="Trust Lines internal PM" status={stage1Status} canAct={isTrustPm  && stage1Status === 'pending'} />
      <StageRow num={2} label="Client PM Approval" hint="T-Lines client PM"       status={stage2Status} canAct={isClientPm && stage2Status === 'pending'} />
      {error && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--status-danger)' }}>{error}</div>}
      {isTrustPm && docStatus !== 'draft' && docStatus !== 'rejected' && (
        <button
          onClick={resetApproval}
          disabled={acting}
          style={{ marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--fg-faint)', textDecoration: 'underline' }}
        >
          Reset to Draft
        </button>
      )}
    </div>
  );
}

function FilePreview({
  proxyUrl, selected, pdfLoading, pdfReady, zoom, selectedId, cacheBust, fileType, onLoad, fullscreen,
}: {
  proxyUrl:   string | null;
  selected:   { file_name: string } | null;
  pdfLoading: boolean;
  pdfReady:   boolean;
  zoom:       number;
  selectedId: string | null;
  cacheBust:  number;
  fileType:   (name: string) => 'pdf' | 'image' | 'other';
  onLoad:     () => void;
  fullscreen?: boolean;
}) {
  const ftype = selected ? fileType(selected.file_name) : 'other';

  const containerStyle: React.CSSProperties = {
    flex:            1,
    background:      fullscreen ? 'transparent' : 'var(--bg-sunken)',
    display:         'flex',
    alignItems:      (selected && ftype === 'image') ? 'flex-start' : (selected ? 'flex-start' : 'center'),
    justifyContent:  'center',
    overflow:        'auto',
    minHeight:       fullscreen ? undefined : 640,
    position:        'relative',
  };

  if (!selected || !proxyUrl) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', color: 'var(--fg-faint)', fontSize: 13 }}>Select a file to preview</div>
      </div>
    );
  }

  if (ftype === 'image') {
    return (
      <div style={containerStyle}>
        {pdfLoading && !pdfReady && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--fg-subtle)' }} />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={`${selectedId ?? ''}-${cacheBust}`}
          src={proxyUrl}
          alt={selected.file_name}
          onLoad={onLoad}
          style={{
            display:    'block',
            width:      `${zoom}%`,
            height:     'auto',
            transition: 'width 150ms',
            maxWidth:   zoom <= 100 ? '100%' : 'none',
          }}
        />
      </div>
    );
  }

  if (ftype === 'pdf') {
    return (
      <div style={containerStyle}>
        {pdfLoading && !pdfReady && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--fg-subtle)' }} />
            <span style={{ fontSize: 12, color: 'var(--fg-faint)' }}>Loading…</span>
          </div>
        )}
        <iframe
          key={`${selectedId ?? ''}-${cacheBust}`}
          src={proxyUrl}
          onLoad={onLoad}
          style={{
            border:     'none',
            display:    'block',
            width:      `${zoom}%`,
            height:     fullscreen ? '85vh' : `${Math.max(640, Math.round(640 * zoom / 100))}px`,
            minWidth:   zoom > 100 ? `${zoom}%` : '100%',
            transition: 'width 150ms, height 150ms',
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ ...containerStyle, flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 13, color: 'var(--fg-subtle)' }}>Preview not available for this file type.</div>
      <div style={{ fontSize: 11, color: 'var(--fg-faint)' }}>{selected.file_name}</div>
    </div>
  );
}

interface Props {
  projectId:          string;
  userId:             string;
  userRole?:          string;
  userPerms?:         PermMap;
  documents:          DocumentRow[];
  auditEvents:        AuditRow[];
  docType?:           string;
  title?:             string;
  catGroup?:          string | null;
  dropboxRootPath?:   string | null;
  onSynced?:          () => void;
  onFullyApproved?:   () => void;
  trustlinesPmId?:    string | null;
  tlinesPmId?:        string | null;
}

export function PlanLayoutTab({
  projectId, userId, userRole, userPerms, documents, auditEvents,
  docType = 'plan_layout', title = 'Item Plan', catGroup,
  dropboxRootPath, onSynced, onFullyApproved, trustlinesPmId, tlinesPmId,
}: Props) {
  const planDocs = (() => {
    const filtered = documents.filter(d =>
      d.doc_type === docType &&
      (catGroup != null ? d.cat_group === catGroup : d.cat_group == null),
    );
    const sorted = [...filtered].sort((a, b) => a.version - b.version);
    const seen   = new Map<string, DocumentRow>();
    for (const doc of sorted) {
      const key = `${doc.dropbox_version ?? doc.version}::${doc.file_name}`;
      seen.set(key, doc);
    }
    return [...seen.values()].sort(
      (a, b) => (a.dropbox_version ?? a.version) - (b.dropbox_version ?? b.version),
    );
  })();

  const planDocsByVersion = (() => {
    const map = new Map<number, DocumentRow[]>();
    for (const doc of planDocs) {
      const v = doc.dropbox_version ?? doc.version;
      if (!map.has(v)) map.set(v, []);
      map.get(v)!.push(doc);
    }
    return map;
  })();

  const versionNumbers = [...planDocsByVersion.keys()].sort((a, b) => a - b);
  const latestVersion  = versionNumbers[versionNumbers.length - 1] ?? 0;
  const [activeVersion, setActiveVersion] = useState<number>(latestVersion);

  const safeVersion = planDocsByVersion.has(activeVersion) ? activeVersion : (versionNumbers[versionNumbers.length - 1] ?? 0);
  const activeVersionDocs = planDocsByVersion.get(safeVersion) ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(
    activeVersionDocs.length > 0 ? activeVersionDocs[activeVersionDocs.length - 1].id : null,
  );
  const selected = planDocs.find(d => d.id === selectedId) ?? null;
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfReady, setPdfReady]     = useState(false);
  const [pdfCacheBust, setPdfCacheBust] = useState(0);
  const [zoom, setZoom]             = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGenerator, setShowGenerator]         = useState(false);
  const [generatorInitSections, setGeneratorInitSections] = useState<unknown[] | undefined>(undefined);
  const [editDocumentId, setEditDocumentId]       = useState<string | undefined>(undefined);
  const [userSignature, setUserSignature]           = useState<string | null | undefined>(undefined);
  const [showSignaturePad, setShowSignaturePad]     = useState(false);
  const pendingApproveRef                           = useRef<(() => void) | null>(null);

  useEffect(() => {
    fetch('/api/user/signature')
      .then(r => r.json())
      .then((j: { base64?: string | null }) => setUserSignature(j.base64 ?? null))
      .catch(() => setUserSignature(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dropbox/check-revisions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, docType, catGroup: catGroup ?? null }),
        });
        if (!res.ok) return;
        const json = await res.json() as { revisions?: { fileName: string }[] };
        if (!cancelled && json.revisions?.length) {
          const names = json.revisions.map(r => r.fileName).join(', ');
          toast.info(`Revision detected in Dropbox: ${names} — approval flow restarted from Stage 1`, { duration: 7000 });
          setPdfCacheBust(Date.now());
          onSynced?.();
        }
      } catch { }
    })();
    return () => { cancelled = true; };
   
  }, [projectId, docType, catGroup]);

  const isGeneratable = (docType === 'item_list' || docType === 'price_list') && !!catGroup;

  interface ILVer { id: string; version: number; file_name: string; form_data: unknown[] | null }
  const [ilVersions, setIlVersions] = useState<ILVer[]>([]);

  useEffect(() => {
    if (docType !== 'price_list' || !catGroup) return;
    const lsKey  = `docgen_il_${projectId}_${catGroup}`;
    const lsData = (() => { try { return JSON.parse(localStorage.getItem(lsKey) ?? '[]') as ILVer[]; } catch { return [] as ILVer[]; } })();
    if (lsData.length > 0) setIlVersions(lsData);
    fetch(`/api/projects/${projectId}/doc-versions?doc_type=item_list&cat_group=${catGroup}`)
      .then(r => r.json())
      .then((j: { versions: ILVer[] }) => {
        const db    = j.versions ?? [];
        const dbIds = new Set(db.map(v => v.version));
        const merged = [...db, ...lsData.filter(v => !dbIds.has(v.version))].sort((a, b) => b.version - a.version);
        setIlVersions(merged.length > 0 ? merged : lsData);
      })
      .catch(() => {});
  }, [projectId, catGroup, docType]);

  function fileType(name: string): 'pdf' | 'image' | 'other' {
    if (/\.pdf$/i.test(name)) return 'pdf';
    if (/\.(jpe?g|png|gif|webp|bmp|svg|tiff?)$/i.test(name)) return 'image';
    return 'other';
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!isFullscreen) return;
      if (e.key === 'Escape') setIsFullscreen(false);
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(300, z + 10));
      if (e.key === '-') setZoom(z => Math.max(25, z - 10));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  const [approvals, setApprovals]           = useState<ApprovalRow[]>([]);
  const [approvalsForDoc, setApprovalsForDoc] = useState<string | null>(null);
  const [approvalsLoading, setApprLoading]  = useState(false);
  const [initiating, setInitiating]       = useState(false);
  const initiateAttempted = useRef<Set<string>>(new Set());

  function handleOptimisticApprove(stageIndex: number, action: 'approve' | 'reject') {
    const now = new Date().toISOString();
    setApprovals(prev => prev.map(a => {
      if (a.stage === stageIndex + 1) {
        return { ...a, status: action === 'approve' ? 'approved' : 'rejected', resolved_at: now };
      }
      if (action === 'approve' && stageIndex === 0 && a.stage === 2 && a.status === 'waiting') {
        return { ...a, status: 'pending' };
      }
      return a;
    }));
  }

  const loadingForDocId = useRef<string | null>(null);

  const loadApprovals = useCallback(async (docId: string, allowClear = true) => {
    loadingForDocId.current = docId;
    setApprLoading(true);
    try {
      const res  = await fetch(`/api/projects/${projectId}/doc-approvals?documentId=${docId}`);
      const data = await res.json() as { approvals?: ApprovalRow[] };
      if (loadingForDocId.current !== docId) return;
      const fetched = data.approvals ?? [];
      setApprovals(prev => (fetched.length > 0 || allowClear) ? fetched : prev);
      setApprovalsForDoc(docId);
    } catch { }
    finally {
      if (loadingForDocId.current === docId) setApprLoading(false);
    }
  }, [projectId]);

  async function handleInitiateApproval() {
    if (!selected || initiating) return;
    setInitiating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/doc-approvals`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:     'initiate',
          documentId: selected.id,
          docType,
          catGroup:   catGroup ?? null,
          versionNum: selected.dropbox_version ?? selected.version,
        }),
      });
      if (!res.ok) {
        if (res.status !== 409) {
          const e = await res.json() as { error?: string };
          console.error('[initiate approval] server error:', e.error);
          throw new Error(e.error ?? 'Failed');
        }
      }
      await new Promise(r => setTimeout(r, 600));
      await loadApprovals(selected.id);
      onSynced?.();
    } catch (e) {
      console.error('[initiate approval]', e);
    } finally {
      setInitiating(false);
    }
  }

  useEffect(() => {
    setPdfReady(false);
    setApprovals([]);
    if (selectedId) {
      setPdfLoading(true);
      loadApprovals(selectedId);
    }
  }, [selectedId, loadApprovals]);

  const PROD_APPROVAL_TYPES = ['proposal', 'item_plan', 'item_list', 'price_list', 'book', 'po_bo', 'pf'];
  const APPROVAL_DOC_TYPES_UI = catGroup
    ? PROD_APPROVAL_TYPES
    : ['plan_layout', 'proposal', 'construction_drawings'];
  const expectedStages = docType === 'pf' ? 4 : approvalStagesFor(docType, catGroup ?? null).length;
  useEffect(() => {
    if (!selected) return;
    if (!APPROVAL_DOC_TYPES_UI.includes(docType)) return;
    if (approvalsLoading) return;
    if (approvals.length >= expectedStages) return;
    if (initiating) return;
    const attemptKey = `${selected.id}::${expectedStages}`;
    if (initiateAttempted.current.has(attemptKey)) return;
    initiateAttempted.current.add(attemptKey);
    void handleInitiateApproval();
   
  }, [selected?.id, approvals.length, approvalsLoading]);

  const SHARED_TYPES = ['proposal', 'item_plan', 'item_list', 'price_list'];
  const SHARED_LABELS: Record<string, string> = { proposal: 'Proposal', item_plan: 'Item Plan', item_list: 'Item List', price_list: 'Item Price List' };
  const catUpperShared = (catGroup ?? '').charAt(0).toUpperCase() + (catGroup ?? '').slice(1);
  const requiredShared = ['Millwork', 'Shelving'].includes(catUpperShared)
    ? ['proposal', 'item_plan', 'item_list', 'price_list']
    : ['item_plan', 'item_list', 'price_list'];
  const isSharedDoc = !!catGroup && SHARED_TYPES.includes(docType);
  const missingShared = isSharedDoc
    ? requiredShared.filter(t => !documents.some(d => d.doc_type === t && d.cat_group === catGroup))
    : [];
  const sharedLocked = isSharedDoc && missingShared.length > 0;

  async function handleEditDoc(doc: DocumentRow) {
    try {
      const res = await fetch(`/api/projects/${projectId}/doc-versions?doc_type=${docType}&cat_group=${catGroup ?? ''}`);
      const json = await res.json() as { versions: { id: string; form_data: unknown[] | null }[] };
      const found = (json.versions ?? []).find(v => v.id === doc.id);
      if (!found?.form_data?.length) {
        toast.error('No saved form data for this version. Regenerate the document first.');
        return;
      }
      setGeneratorInitSections(found.form_data);
      setEditDocumentId(doc.id);
      setShowGenerator(true);
    } catch {
      toast.error('Failed to load document data.');
    }
  }

  const versionLabel = (doc: DocumentRow) =>
    `${title} V${doc.dropbox_version ?? doc.version}`;

  const proxyUrl = selectedId && selected
    ? `/api/files/proxy/${encodeURIComponent(selected.file_name)}?documentId=${selectedId}${pdfCacheBust ? `&t=${pdfCacheBust}` : ''}`
    : null;

  const lifecycle = (() => {
    if (!selected) return null;
    const v = selected.dropbox_version ?? selected.version;
    if (selected.status === 'approved') return { label: `Completed V${v}`, bg: 'var(--status-success-bg)', fg: 'var(--status-success-fg)', border: 'var(--status-success)' };
    if (selected.status === 'rejected') return { label: `Rejected V${v}`,  bg: 'var(--status-danger-bg)', fg: 'var(--status-danger)', border: 'var(--status-danger)' };
    const rows  = approvalsForDoc === selectedId ? approvals : [];
    const total = rows.length;
    const trustPmSigned = total >= 2 && rows[total - 2]?.status === 'approved';
    if (trustPmSigned) return { label: `Signed V${v}`, bg: 'var(--status-info-bg)', fg: 'var(--status-info-fg)', border: 'var(--status-info)' };
    return { label: `DRAFT V${v}`, bg: 'var(--status-warning-bg)', fg: 'var(--status-warning)', border: 'var(--status-warning)' };
  })();

  async function handleDownload() {
    if (!selectedId || !selected) return;
    const res  = await fetch(`/api/files/view?documentId=${selectedId}`);
    const data = await res.json() as { link?: string };
    if (!data.link) return;
    const a = document.createElement('a');
    a.href = data.link;
    a.download = selected.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleOpenNew() {
    if (!selectedId) return;
    const res  = await fetch(`/api/files/view?documentId=${selectedId}`);
    const data = await res.json() as { link?: string };
    if (data.link) window.open(data.link, '_blank');
  }

  if (showGenerator && isGeneratable) {
    return (
      <DocGeneratorModal
        projectId={projectId}
        catGroup={catGroup!}
        docType={docType as 'item_list' | 'price_list'}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialSections={generatorInitSections as any}
        editDocumentId={editDocumentId}
        onClose={() => { setShowGenerator(false); setGeneratorInitSections(undefined); setEditDocumentId(undefined); }}
        onGenerated={() => {
          setShowGenerator(false); setGeneratorInitSections(undefined); setEditDocumentId(undefined);
          onSynced?.();
        }}
      />
    );
  }

  const isAssignedApprover = approvals.some(a => a.assigned_to === userId);
  const noSignatureBanner  = isAssignedApprover && userSignature === null;

  return (
    <>
    {showSignaturePad && (
      <SignaturePad
        existingBase64={userSignature}
        onSaved={b64 => {
          setUserSignature(b64);
          setShowSignaturePad(false);
          const cb = pendingApproveRef.current;
          pendingApproveRef.current = null;
          cb?.();
        }}
        onClose={() => { setShowSignaturePad(false); pendingApproveRef.current = null; }}
      />
    )}

    {noSignatureBanner && (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', marginBottom: 12,
        background: 'var(--status-warning-bg)', border: '1px solid var(--status-warning)', borderRadius: 7,
      }}>
        <span style={{ fontSize: 18 }}>✍️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--status-warning-fg)' }}>Signature not set up</div>
          <div style={{ fontSize: 11, color: 'var(--status-warning)' }}>Your signature will be embedded in PDFs when you approve documents.</div>
        </div>
        <button
          onClick={() => setShowSignaturePad(true)}
          style={{ padding: '5px 14px', borderRadius: 5, border: 'none', background: 'var(--status-warning)', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}
        >
          Set Up Signature
        </button>
      </div>
    )}

    {isAssignedApprover && userSignature && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', marginBottom: 10, background: 'var(--status-success-bg)', border: '1px solid var(--status-success-bg)', borderRadius: 6 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={userSignature} alt="Your signature" style={{ height: 28, maxWidth: 120, objectFit: 'contain' }} />
        <div style={{ flex: 1, fontSize: 11, color: 'var(--status-success)', fontWeight: 600 }}>Signature saved — will appear on approvals</div>
        <button onClick={() => setShowSignaturePad(true)} style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-subtle)', textDecoration: 'underline' }}>
          Change
        </button>
      </div>
    )}

    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 300px', gap: 16, alignItems: 'start' }}>

      <div className="card" style={{ padding: 0 }}>
        <div style={{
          padding: '11px 14px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <DropboxIcon size={14} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-default)' }}>
            Dropbox {title} Versions
          </span>
        </div>

        {(dropboxRootPath || isGeneratable) && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            {isGeneratable && docType === 'item_list' && (
              <button
                onClick={() => { setGeneratorInitSections(undefined); setShowGenerator(true); }}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '5px 12px' }}
              >
                <FilePlus2 size={13} /> Create Item List
              </button>
            )}
            {dropboxRootPath && (
              <div style={{ marginLeft: 'auto' }}>
                <DropboxSyncBtn
                  projectId={projectId}
                  dropboxRootPath={dropboxRootPath}
                  docType={docType}
                  catGroup={catGroup ?? null}
                  stepKey={docType}
                  linkedVersions={new Set(planDocs.map(d => d.dropbox_version ?? d.version))}
                  onSynced={onSynced ?? (() => window.location.reload())}
                />
              </div>
            )}
          </div>
        )}

        {docType === 'price_list' && isGeneratable && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Open Item List for Pricing
            </div>
            {ilVersions.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginBottom: 6 }}>
                No Item List versions found.<br />Create an Item List first.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ilVersions.map(ver => (
                  <div key={ver.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--bg-subtle)', borderRadius: 5, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>V{ver.version}</div>
                      <div style={{ fontSize: 10, color: 'var(--fg-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ver.file_name.replace(/\.pdf$/i, '')}</div>
                    </div>
                    <button
                      onClick={() => {
                        if (!ver.form_data?.length) { alert('No saved data for this version. Please regenerate the Item List first.'); return; }
                        setGeneratorInitSections(ver.form_data);
                        setShowGenerator(true);
                      }}
                      style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '4px 10px', background: 'var(--status-danger)', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Open for Pricing
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {planDocs.length === 0 ? (
          <div style={{ padding: '32px 14px', textAlign: 'center', fontSize: 12, color: 'var(--fg-faint)' }}>
            No {title} files yet.{dropboxRootPath ? ' Use the Dropbox button to sync.' : ''}
          </div>
        ) : (
          <>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 4,
              padding: '8px 12px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'var(--bg-subtle)',
            }}>
              {versionNumbers.map(vNum => {
                const isActive = vNum === safeVersion;
                return (
                  <button
                    key={vNum}
                    type="button"
                    onClick={() => {
                      setActiveVersion(vNum);
                      const first = planDocsByVersion.get(vNum)?.[0];
                      if (first) setSelectedId(first.id);
                    }}
                    style={{
                      padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', border: 'none', transition: 'all 100ms',
                      background: isActive ? 'var(--brand-teal)' : 'var(--bg-surface)',
                      color:      isActive ? 'white'    : 'var(--fg-muted)',
                      boxShadow:  isActive ? 'none'    : 'inset 0 0 0 1px var(--border-default)',
                    }}
                  >
                    V{vNum}
                  </button>
                );
              })}
            </div>

            {activeVersionDocs.map(doc => {
              const isSelected = doc.id === selectedId;
              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedId(doc.id)}
                  style={{
                    padding: '9px 14px',
                    borderBottom: '1px solid var(--border-subtle)',
                    borderLeft: `3px solid ${isSelected ? 'var(--status-info)' : 'transparent'}`,
                    background: isSelected ? 'var(--status-info-bg)' : 'white',
                    cursor: 'pointer', transition: 'all 80ms',
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{
                      width: 32, height: 38, borderRadius: 4, flexShrink: 0, background: 'var(--status-danger-bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, fontWeight: 900, color: 'var(--status-danger)', letterSpacing: '0.06em',
                      border: '1px solid var(--status-danger)',
                    }}>
                      {doc.file_name.split('.').pop()?.toUpperCase().slice(0, 4) ?? 'FILE'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 11, fontWeight: 600, color: 'var(--fg-default)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        marginBottom: 1,
                      }}>
                        {doc.file_name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--fg-faint)' }}>
                        {new Date(doc.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: '#0061FF' }}>
                      <DropboxIcon size={9} />Dropbox Synced
                    </span>
                    <DocStatusBadge status={doc.status} />
                    {doc.status === 'rejected' && isGeneratable && (
                      <button
                        onClick={e => { e.stopPropagation(); void handleEditDoc(doc); }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                          background: 'var(--status-warning-bg)', color: 'var(--status-warning)', border: '1px solid var(--status-warning)',
                          cursor: 'pointer',
                        }}
                      >
                        <Pencil size={9} /> Edit
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 700 }}>
        <div style={{
          padding: '8px 14px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-default)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
              {selected ? `Viewing: ${versionLabel(selected)}` : 'Select a file'}
            </span>
            {lifecycle && (
              <span style={{
                fontSize: 11, fontWeight: 800, letterSpacing: 0.4, whiteSpace: 'nowrap',
                padding: '3px 10px', borderRadius: 99,
                background: lifecycle.bg, color: lifecycle.fg, border: `1.5px solid ${lifecycle.border}`,
                textTransform: 'uppercase',
              }}>
                {lifecycle.label}
              </span>
            )}
          </span>
          {selected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <button style={toolBtn} onClick={() => setZoom(z => Math.max(25, z - 10))}><ZoomOut size={12} /></button>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', minWidth: 38, textAlign: 'center' }}>{zoom}%</span>
              <button style={toolBtn} onClick={() => setZoom(z => Math.min(300, z + 10))}><ZoomIn size={12} /></button>
              <button style={{ ...toolBtn, fontSize: 9, fontWeight: 700 }} onClick={() => setZoom(100)} title="Reset zoom">1:1</button>
              <div style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 2px' }} />
              <button style={toolBtn} onClick={handleDownload} title="Download"><Download size={12} /></button>
              <button style={toolBtn} onClick={handleOpenNew} title="Open in Dropbox"><ExternalLink size={12} /></button>
              <button style={toolBtn} title="Fullscreen" onClick={() => { setIsFullscreen(true); setZoom(100); }}>
                <Maximize2 size={12} />
              </button>
            </div>
          )}
        </div>

        <FilePreview
          proxyUrl={proxyUrl}
          selected={selected}
          pdfLoading={pdfLoading}
          pdfReady={pdfReady}
          zoom={zoom}
          selectedId={selectedId}
          cacheBust={pdfCacheBust}
          fileType={fileType}
          onLoad={() => { setPdfLoading(false); setPdfReady(true); }}
        />
      </div>

      {isFullscreen && selected && proxyUrl && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.95)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 16px', background: 'rgba(0,0,0,0.6)', flexShrink: 0,
          }}>
            <span style={{ color: 'white', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40vw' }}>
              {selected.file_name}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button style={{ ...toolBtn, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                onClick={() => setZoom(z => Math.max(25, z - 10))}><ZoomOut size={14} /></button>
              <span style={{ color: 'white', fontSize: 12, fontWeight: 700, minWidth: 42, textAlign: 'center' }}>{zoom}%</span>
              <button style={{ ...toolBtn, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                onClick={() => setZoom(z => Math.min(300, z + 10))}><ZoomIn size={14} /></button>
              <button style={{ ...toolBtn, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontSize: 9, fontWeight: 700 }}
                onClick={() => setZoom(100)}>1:1</button>
              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
              <button style={{ ...toolBtn, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                onClick={handleDownload}><Download size={14} /></button>
              <button style={{ ...toolBtn, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                onClick={handleOpenNew}><ExternalLink size={14} /></button>
              <button
                onClick={() => setIsFullscreen(false)}
                style={{
                  marginLeft: 8, padding: '4px 12px', borderRadius: 5, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                  color: 'white', fontSize: 12, fontWeight: 700,
                }}
              >
                ✕ Close
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16 }}>
            <FilePreview
              proxyUrl={proxyUrl}
              selected={selected}
              pdfLoading={false}
              pdfReady={true}
              zoom={zoom}
              selectedId={selectedId}
              cacheBust={pdfCacheBust}
              fileType={fileType}
              onLoad={() => {}}
              fullscreen
            />
          </div>

          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 10, padding: '4px 0 8px' }}>
            Esc to close · + / − to zoom
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-default)' }}>Document Approval</span>
            {(approvalsLoading || initiating) && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', color: 'var(--fg-faint)' }} />}
          </div>

          {!selected && (
            <div style={{ padding: '16px', fontSize: 12, color: 'var(--fg-faint)', textAlign: 'center' }}>
              Select a file to see its approval status.
            </div>
          )}

          {selected && sharedLocked && (
            <div style={{ margin: '0 16px 12px', padding: '12px 14px', background: 'var(--status-warning-bg)', border: '1px solid var(--status-warning)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--status-warning-fg)' }}>🔒 Signing not open yet</div>
              <div style={{ fontSize: 11, color: 'var(--status-warning)', marginTop: 4 }}>
                {catUpperShared} Proposal, Item Plan, Item List and Item Price List are signed together. Waiting for:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {missingShared.map(t => (
                  <span key={t} style={{ padding: '2px 9px', borderRadius: 99, background: 'var(--status-warning-bg)', color: 'var(--status-warning)', fontSize: 11, fontWeight: 700 }}>{SHARED_LABELS[t] ?? t}</span>
                ))}
              </div>
            </div>
          )}

          {selected && !sharedLocked && approvals.length > 0 && approvalsForDoc === selectedId && (
            <div style={{ padding: '16px' }}>
              {getApprovalStages(docType, catGroup).map(({ label, hint }, i) => {
                const approval = approvals.find(a => a.stage === i + 1) ?? null;
                const stages   = getApprovalStages(docType, catGroup);
                const needPerm = signPermForStage(docType, catGroup ?? null, i + 1);
                const canSignByRole = !!needPerm && permCan(userPerms, needPerm);
                return (
                  <ApprovalStage
                    key={i}
                    index={i}
                    label={label}
                    hint={hint}
                    approval={approval}
                    isLast={i === stages.length - 1}
                    userId={userId}
                    canSignByRole={canSignByRole}
                    projectId={projectId}
                    onRefresh={() => selectedId && void loadApprovals(selectedId, false)}
                    onSynced={onSynced}
                    onPdfSigned={() => { setPdfLoading(true); setPdfReady(false); setPdfCacheBust(Date.now()); }}
                    onApproveOptimistic={handleOptimisticApprove}
                    userSignature={userSignature ?? null}
                    onNeedSignature={cb => { pendingApproveRef.current = cb; setShowSignaturePad(true); }}
                  />
                );
              })}
            </div>
          )}

          {selected && !sharedLocked && approvals.length === 0 && approvalsForDoc === selectedId && !initiating && (
            <RoleApprovalFallback
              projectId={projectId}
              documentId={selected.id}
              docType={docType}
              versionNum={selected.dropbox_version ?? selected.version}
              docStatus={selected.status}
              userId={userId}
              trustlinesPmId={trustlinesPmId ?? null}
              tlinesPmId={tlinesPmId ?? null}
              onDone={() => void loadApprovals(selected.id, false)}
              onFullyApproved={onSynced}
            />
          )}
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-default)' }}>Activity Timeline</span>
          </div>
          <div style={{ padding: '12px 16px', maxHeight: 340, overflowY: 'auto' }}>
            {auditEvents.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--fg-faint)', textAlign: 'center', padding: '20px 0' }}>No activity yet</div>
            ) : (
              auditEvents.slice(0, 10).map((event, i) => (
                <div
                  key={event.id}
                  style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    paddingBottom: i < 9 ? 12 : 0, marginBottom: i < 9 ? 12 : 0,
                    borderBottom: i < 9 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--status-info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CheckCircle2 size={13} color="var(--status-info)" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-default)', marginBottom: 1 }}>
                      {formatAction(event.action)}
                    </div>
                    {event.actor && <div style={{ fontSize: 10, color: 'var(--fg-subtle)', marginBottom: 1 }}>{event.actor.full_name}</div>}
                    <div style={{ fontSize: 10, color: 'var(--fg-faint)' }}>
                      {new Date(event.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>

    </>
  );
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
