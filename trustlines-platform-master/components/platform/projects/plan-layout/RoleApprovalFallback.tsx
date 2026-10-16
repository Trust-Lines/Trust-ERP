'use client';

import { useState } from 'react';
import { XCircle, ThumbsDown, Loader2 } from 'lucide-react';

export function RoleApprovalFallback({
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
