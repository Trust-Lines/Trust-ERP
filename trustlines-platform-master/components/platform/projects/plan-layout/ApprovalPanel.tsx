'use client';

import { Loader2 } from 'lucide-react';
import { signPermForStage } from '@/lib/approvals/stageConfig';
import { permCan, type PermMap } from '@/lib/permissions/catalog';
import type { DocumentRow } from '../ProjectDetailClient';
import { ApprovalStage } from './ApprovalStage';
import { RoleApprovalFallback } from './RoleApprovalFallback';
import { getApprovalStages, type ApprovalRow } from './shared';

/** Right column "Document Approval" card: stage-by-stage signing, or the two-PM fallback. */
export function ApprovalPanel({
  projectId, userId, userPerms, docType, catGroup, selected, selectedId,
  approvals, approvalsForDoc, approvalsLoading, initiating,
  sharedLocked, catUpperShared, missingShared, sharedLabels,
  trustlinesPmId, tlinesPmId, userSignature,
  onLoadApprovals, onSynced, onPdfSigned, onApproveOptimistic, onNeedSignature,
}: {
  projectId: string;
  userId: string;
  userPerms?: PermMap;
  docType: string;
  catGroup?: string | null;
  selected: DocumentRow | null;
  selectedId: string | null;
  approvals: ApprovalRow[];
  approvalsForDoc: string | null;
  approvalsLoading: boolean;
  initiating: boolean;
  sharedLocked: boolean;
  catUpperShared: string;
  missingShared: string[];
  sharedLabels: Record<string, string>;
  trustlinesPmId?: string | null;
  tlinesPmId?: string | null;
  userSignature: string | null | undefined;
  onLoadApprovals: (docId: string, allowClear?: boolean) => Promise<void>;
  onSynced?: () => void;
  onPdfSigned: () => void;
  onApproveOptimistic: (stageIndex: number, action: 'approve' | 'reject') => void;
  onNeedSignature: (onDone: () => void) => void;
}) {
  return (
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
                  <span key={t} style={{ padding: '2px 9px', borderRadius: 99, background: 'var(--status-warning-bg)', color: 'var(--status-warning)', fontSize: 11, fontWeight: 700 }}>{sharedLabels[t] ?? t}</span>
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
                    onRefresh={() => selectedId && void onLoadApprovals(selectedId, false)}
                    onSynced={onSynced}
                    onPdfSigned={onPdfSigned}
                    onApproveOptimistic={onApproveOptimistic}
                    userSignature={userSignature ?? null}
                    onNeedSignature={onNeedSignature}
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
              onDone={() => void onLoadApprovals(selected.id, false)}
              onFullyApproved={onSynced}
            />
          )}
        </div>
  );
}
