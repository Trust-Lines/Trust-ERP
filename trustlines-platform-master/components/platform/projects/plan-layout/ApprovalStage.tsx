'use client';

import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { ApprovalActionBar } from '../../approvals/ApprovalActionBar';
import type { ApprovalRow } from './shared';

export function ApprovalStage({
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
