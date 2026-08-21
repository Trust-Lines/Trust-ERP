'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface ApprovalActionBarProps {
  approvalId:   string;
  projectId:    string;
  isFinalStage: boolean;
  versionNum:   number | null;
  userSignature: string | null | undefined;
  onNeedSignature?: (resume: () => void) => void;
  onDone:            () => void;
  onApproveOptimistic?: () => void;
  onPdfSigned?:      () => void;
  onSynced?:         () => void;
  size?: 'sm' | 'md';
}

export function ApprovalActionBar({
  approvalId, projectId, isFinalStage, versionNum,
  userSignature, onNeedSignature, onDone, onApproveOptimistic, onPdfSigned, onSynced,
  size = 'sm',
}: ApprovalActionBarProps) {
  const [acting, setActing]         = useState(false);
  const [rejecting, setRejecting]   = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  const md = size === 'md';
  const padBtn = md ? '7px 16px' : '4px 10px';
  const fsBtn  = md ? 13 : 11;
  const icon   = md ? 13 : 10;

  async function act(action: 'approve' | 'reject') {
    if (action === 'approve' && userSignature === null) {
      onNeedSignature?.(() => void act('approve'));
      return;
    }

    setActing(true);
    if (action === 'approve') onApproveOptimistic?.();

    try {
      const res = await fetch(`/api/projects/${projectId}/doc-approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, approvalId, notes: action === 'reject' ? rejectNote : undefined }),
      });
      if (!res.ok) {
        const e = await res.json() as { error?: string };
        throw new Error(e.error ?? 'Failed');
      }
      const json = await res.json() as { signatureApplied?: boolean; nextVersionOpened?: number | null };
      if (action === 'approve') {
        toast.success(json.signatureApplied ? 'Approved — signature stamped on PDF ✍️' : 'Approved');
        if (json.signatureApplied) onPdfSigned?.();
        onSynced?.();
      } else if (json.nextVersionOpened != null) {
        toast.success(`Rejected — V${json.nextVersionOpened} folder opened in Dropbox for the revision`, { duration: 7000 });
      } else {
        toast.success('Rejected');
      }
      setRejecting(false);
      setTimeout(() => onDone(), 350);
    } catch (e) {
      onDone();
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally { setActing(false); }
  }

  if (rejecting) {
    return (
      <div style={{ marginTop: 8 }}>
        {isFinalStage && (
          <div style={{ fontSize: 10, color: '#b45309', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 5, padding: '5px 8px', marginBottom: 5 }}>
            ⚠️ Final-stage rejection opens the next version
            {versionNum != null ? ` (V${versionNum + 1})` : ''} for the whole document set.
          </div>
        )}
        <textarea
          value={rejectNote}
          onChange={e => setRejectNote(e.target.value)}
          placeholder="Reason for rejection (required)"
          rows={2}
          style={{
            width: '100%', fontSize: md ? 12 : 11, padding: '6px 8px',
            border: `1px solid ${rejectNote.trim() ? 'var(--border-default)' : '#fca5a5'}`,
            borderRadius: 5, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 5, marginTop: 5, alignItems: 'center' }}>
          <button
            onClick={() => act('reject')}
            disabled={acting || !rejectNote.trim()}
            style={{
              padding: padBtn, borderRadius: 5, fontSize: fsBtn, fontWeight: 600,
              background: rejectNote.trim() ? '#dc2626' : '#fca5a5', color: 'white', border: 'none',
              cursor: rejectNote.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {acting ? '…' : 'Confirm Reject'}
          </button>
          <button
            onClick={() => { setRejecting(false); setRejectNote(''); }}
            style={{ padding: '4px 8px', borderRadius: 5, fontSize: fsBtn, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-subtle)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      {userSignature === null && (
        <div style={{ fontSize: md ? 11 : 10, color: '#b45309', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
          ✍️ You&apos;ll draw your signature before approving
        </div>
      )}
      {userSignature && (
        <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={userSignature} alt="Your signature" style={{ height: md ? 26 : 22, maxWidth: 110, objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: 3, background: '#fff', padding: '1px 3px' }} />
          <span style={{ fontSize: md ? 11 : 10, color: '#16a34a' }}>will be stamped on PDF</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => void act('approve')}
          disabled={acting}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: padBtn, borderRadius: 5, fontSize: fsBtn, fontWeight: 600, cursor: 'pointer',
            background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac',
          }}
        >
          {acting ? <Loader2 size={icon} style={{ animation: 'spin 1s linear infinite' }} /> : <ThumbsUp size={icon} />}
          {userSignature === null ? 'Approve & Sign…' : 'Approve'}
        </button>
        <button
          onClick={() => setRejecting(true)}
          disabled={acting}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: padBtn, borderRadius: 5, fontSize: fsBtn, fontWeight: 600, cursor: 'pointer',
            background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5',
          }}
        >
          <ThumbsDown size={icon} /> Reject
        </button>
      </div>
    </div>
  );
}
