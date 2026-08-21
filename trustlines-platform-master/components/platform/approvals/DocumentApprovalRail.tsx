'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';
import { ApprovalActionBar } from './ApprovalActionBar';
import { signPermForStage } from '@/lib/approvals/stageConfig';
import { permCan, type PermMap } from '@/lib/permissions/catalog';

interface ApprovalRow {
  id: string; stage: number; status: string; assigned_to: string | null;
  approved_by: string | null; notes: string | null; resolved_at: string | null; version_num: number | null;
}

export function DocumentApprovalRail({
  projectId, documentId, docType, catGroup, versionNum, userId, userPerms, userSignature,
  stages, onNeedSignature, onChanged,
}: {
  projectId: string;
  documentId: string;
  docType: string;
  catGroup?: string | null;
  versionNum: number;
  userId: string;
  userPerms?: PermMap;
  userSignature: string | null | undefined;
  stages: { label: string; hint: string }[];
  onNeedSignature?: (resume: () => void) => void;
  onChanged?: () => void;
}) {
  const [approvals, setApprovals] = useState<ApprovalRow[] | null>(null);
  const initiatedFor = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/doc-approvals?documentId=${documentId}`);
      const data = await res.json() as { approvals?: ApprovalRow[] };
      setApprovals(data.approvals ?? []);
    } catch { setApprovals([]); }
  }, [projectId, documentId]);

  useEffect(() => { setApprovals(null); void load(); }, [load]);

  useEffect(() => {
    if (approvals === null) return;
    if (approvals.length >= stages.length) return;
    const key = `${documentId}:${approvals.length}`;
    if (initiatedFor.current === key) return;
    initiatedFor.current = key;
    (async () => {
      try {
        await fetch(`/api/projects/${projectId}/doc-approvals`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'initiate', documentId, docType, catGroup: catGroup ?? null, versionNum }),
        });
        await new Promise(r => setTimeout(r, 400));
        await load();
      } catch { }
    })();
  }, [approvals, projectId, documentId, docType, catGroup, versionNum, load, stages.length]);

  if (approvals === null) {
    return <div style={{ padding: 24, textAlign: 'center' }}><Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--fg-subtle)' }} /></div>;
  }

  return (
    <div>
      {stages.map((st, i) => {
        const a = approvals.find(x => x.stage === i + 1) ?? null;
        const status = a?.status ?? 'waiting';
        const needPerm = signPermForStage(docType, catGroup ?? null, i + 1);
        const isMyTurn = status === 'pending' && (a?.assigned_to === userId || (!!needPerm && permCan(userPerms, needPerm)));
        const icon = status === 'approved' ? <CheckCircle2 size={14} color="#16a34a" />
          : status === 'rejected' ? <XCircle size={14} color="#dc2626" />
          : <Clock size={14} color={status === 'pending' ? '#d97706' : '#9ca3af'} />;
        const badge = status === 'approved' ? ['#dcfce7', '#16a34a', 'Approved']
          : status === 'rejected' ? ['#fee2e2', '#dc2626', 'Rejected']
          : status === 'pending' ? ['#fef3c7', '#d97706', 'Pending']
          : ['#f3f4f6', '#9ca3af', 'Waiting'];
        return (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: badge[0], border: `2px solid ${badge[1]}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
              {i < stages.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 20, background: '#e5e7eb', margin: '4px 0' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{i + 1}. {st.label}</div>
              <div style={{ fontSize: 10, color: 'var(--fg-faint)', marginBottom: 4 }}>{st.hint}</div>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: badge[0], color: badge[1] }}>{badge[2]}</span>
              {status === 'approved' && a?.resolved_at && (
                <div style={{ fontSize: 10, color: 'var(--fg-faint)', marginTop: 3 }}>
                  {new Date(a.resolved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {a.version_num != null && <span style={{ marginLeft: 6, fontWeight: 700, color: '#16a34a' }}>V{a.version_num}</span>}
                </div>
              )}
              {status === 'rejected' && a?.notes && <div style={{ fontSize: 10, color: '#dc2626', marginTop: 2 }}>{a.notes}</div>}
              {status === 'pending' && !isMyTurn && <div style={{ fontSize: 10, color: 'var(--fg-faint)', marginTop: 2 }}>Waiting for the assignee</div>}
              {status === 'waiting' && <div style={{ fontSize: 10, color: 'var(--fg-faint)', marginTop: 2 }}>Activates after the previous stage</div>}
              {isMyTurn && a && (
                <ApprovalActionBar
                  approvalId={a.id}
                  projectId={projectId}
                  isFinalStage={i === stages.length - 1}
                  versionNum={a.version_num}
                  userSignature={userSignature}
                  onNeedSignature={onNeedSignature}
                  onPdfSigned={onChanged}
                  onSynced={onChanged}
                  onDone={() => { void load(); onChanged?.(); }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
