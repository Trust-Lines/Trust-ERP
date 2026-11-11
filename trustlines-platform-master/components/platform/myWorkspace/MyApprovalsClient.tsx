'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/feedback-states';
import { ConfirmModal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PANEL, TD_CLS, TH_CLS } from '@/components/platform/marketing/pr/shared';
import { ApprovalReviewDialog } from '@/components/platform/approvals/ApprovalReviewDialog';
import { DOC_LABELS } from '@/components/platform/approvals/docLabels';
import type { MyApproval } from '@/lib/approvals/mine';
import { formatDate, formatDateTime } from '@/lib/formatDate';
import { cn } from '@/lib/utils';

const SignaturePad = dynamic(() => import('@/components/platform/SignaturePad').then(m => ({ default: m.SignaturePad })), { ssr: false });

// My Workspace → My Approvals: everything waiting on the signed-in person's decision, read from
// the approval flows that already exist — nothing is approved any other way:
//   Documents  GET /api/approvals/mine (assigned to me, or a stage my role signs); decided in the
//              Approvals inbox's own review dialog → POST /api/projects/:id/doc-approvals, which
//              keeps the stage order.
//   HR         GET /api/hr/requests?scope=team (people I manage), pending ones; decided with
//              PATCH /api/hr/requests/:id, which re-checks that I manage the requester.

interface HrRequestRow {
  id: string; user_id: string; kind: 'leave' | 'correction'; reason: string | null;
  start_date: string | null; end_date: string | null; correction_kind: string | null; correction_at: string | null;
  priority: string; description: string | null; status: string; created_at: string;
}

type Row =
  | { source: 'document'; id: string; at: string; doc: MyApproval }
  | { source: 'hr'; id: string; at: string; hr: HrRequestRow; person: string };

const SOURCE_LABEL = { document: 'Project documents', hr: 'HR requests' } as const;
const PUNCH: Record<string, string> = { in: 'Clock in', break_start: 'Break start', break_end: 'Break end', out: 'Clock out' };

function hrSummary(r: HrRequestRow): string {
  if (r.kind === 'leave') {
    const reason = r.reason ? r.reason.charAt(0).toUpperCase() + r.reason.slice(1) : 'Leave';
    const range = r.start_date === r.end_date ? formatDate(r.start_date) : `${formatDate(r.start_date)} – ${formatDate(r.end_date)}`;
    return `${reason} leave · ${range}`;
  }
  return `Punch correction · ${PUNCH[r.correction_kind ?? ''] ?? r.correction_kind ?? ''} ${formatDateTime(r.correction_at)}`;
}

export function MyApprovalsClient() {
  const router = useRouter();
  const [docs, setDocs] = useState<MyApproval[] | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [hr, setHr] = useState<{ rows: HrRequestRow[]; names: Record<string, string> } | null>(null);
  const [hrNote, setHrNote] = useState<string | null>(null);
  const [fSource, setFSource] = useState('');
  const [reviewing, setReviewing] = useState<MyApproval | null>(null);
  const [deciding, setDeciding] = useState<{ row: HrRequestRow; action: 'approve' | 'reject' } | null>(null);
  const [note, setNote] = useState('');
  const [signature, setSignature] = useState<string | null | undefined>(undefined);
  const [signing, setSigning] = useState(false);
  const resumeRef = useRef<(() => void) | null>(null);

  const load = useCallback(async () => {
    const [d, h] = await Promise.all([
      fetch('/api/approvals/mine').catch(() => null),
      fetch('/api/hr/requests?scope=team').catch(() => null),
    ]);
    const db = await d?.json().catch(() => ({})) as { approvals?: MyApproval[]; error?: string } | undefined;
    if (d?.ok) { setDocs(db?.approvals ?? []); setDocError(null); }
    else { setDocError(db?.error ?? 'Could not load your document approvals.'); setDocs(prev => prev ?? []); }

    const hb = await h?.json().catch(() => ({})) as { requests?: HrRequestRow[]; names?: Record<string, string>; error?: string } | undefined;
    if (h?.ok) { setHr({ rows: (hb?.requests ?? []).filter(r => r.status === 'pending'), names: hb?.names ?? {} }); setHrNote(null); }
    else { setHr({ rows: [], names: {} }); setHrNote(h?.status === 503 ? (hb?.error ?? 'HR requests aren’t set up yet.') : (hb?.error ?? 'Could not load HR requests.')); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  // Same refresh rhythm as the Approvals inbox: on focus and every 30 s while visible.
  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    const iv = setInterval(() => { if (!document.hidden) void load(); }, 30_000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(iv); };
  }, [load]);
  useEffect(() => {
    fetch('/api/user/signature').then(r => r.json()).then((j: { base64?: string | null }) => setSignature(j.base64 ?? null)).catch(() => setSignature(null));
  }, []);

  function afterAction() { void load(); router.refresh(); }

  const rows = useMemo<Row[]>(() => [
    ...(docs ?? []).map(doc => ({ source: 'document' as const, id: doc.approvalId, at: doc.createdAt, doc })),
    ...(hr?.rows ?? []).map(r => ({ source: 'hr' as const, id: r.id, at: r.created_at, hr: r, person: hr?.names[r.user_id] ?? 'Team member' })),
  ].filter(r => !fSource || r.source === fSource).sort((a, b) => a.at.localeCompare(b.at)), [docs, hr, fSource]);

  async function decideHr() {
    if (!deciding) return;
    if (deciding.action === 'reject' && !note.trim()) { toast.error('Write a reason for the rejection'); throw new Error('note'); }
    const res = await fetch(`/api/hr/requests/${deciding.row.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: deciding.action, note: note.trim() || undefined }),
    }).catch(() => null);
    const b = await res?.json().catch(() => ({})) as { error?: string } | undefined;
    if (!res?.ok) { toast.error(b?.error ?? 'Could not save the decision'); throw new Error('decide'); }
    toast.success(deciding.action === 'approve' ? 'Request approved' : 'Request rejected');
    setDeciding(null);
    setNote('');
    afterAction();
  }

  const loading = docs === null || hr === null;
  const hasHr = (hr?.rows.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[13px] text-ui-body">
          {loading ? 'Loading…' : `${rows.length} waiting on you`}
        </p>
        {(docs?.length ?? 0) > 0 && hasHr && (
          <Select aria-label="Source" className="h-9 w-auto min-w-[170px]" value={fSource} onValueChange={v => setFSource(v ?? '')}
            options={[{ value: '', label: 'All sources' }, { value: 'document', label: SOURCE_LABEL.document }, { value: 'hr', label: SOURCE_LABEL.hr }]} />
        )}
      </div>

      {docError && <div className={cn(PANEL, 'p-5')}><ErrorState title="Document approvals aren’t available" description={docError} /></div>}

      <div className={cn(PANEL, 'overflow-hidden')}>
        {loading ? (
          <p role="status" className="m-0 p-6 text-center text-[13px] text-ui-text-secondary">Loading your approvals…</p>
        ) : rows.length === 0 ? (
          <EmptyState size="sm" className="p-8" icon={<CheckSquare />} title="Nothing is waiting for your approval." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="border-b border-ui-divider bg-ui-surface">
                  <th scope="col" className={TH_CLS}>Request</th>
                  <th scope="col" className={TH_CLS}>Project / person</th>
                  <th scope="col" className={TH_CLS}>Source</th>
                  <th scope="col" className={TH_CLS}>Requested</th>
                  <th scope="col" className={TH_CLS}>Status</th>
                  <th scope="col" className={cn(TH_CLS, 'text-right')}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={`${r.source}-${r.id}`} className="border-b border-ui-divider last:border-b-0">
                    {r.source === 'document' ? (
                      <>
                        <td className={cn(TD_CLS, 'max-w-[300px]')}>
                          <span className="block truncate text-[13px] font-medium text-ui-heading" title={r.doc.fileName}>
                            {DOC_LABELS[r.doc.docType] ?? r.doc.docType} · V{r.doc.versionNum ?? r.doc.version}
                          </span>
                          <span className="block truncate text-ui-text-secondary">{r.doc.fileName}</span>
                        </td>
                        <td className={cn(TD_CLS, 'max-w-[220px]')}>
                          <Link href={`/projects/${r.doc.projectId}`} className="block truncate text-ui-link no-underline hover:underline">
                            {[r.doc.projectCode, r.doc.projectName].filter(Boolean).join(' — ')}
                          </Link>
                        </td>
                        <td className={TD_CLS}>{SOURCE_LABEL.document}</td>
                        <td className={cn(TD_CLS, 'whitespace-nowrap')}>{formatDate(r.at)}</td>
                        <td className={TD_CLS}>
                          <span className="inline-flex rounded-[4px] px-2 py-0.5 font-medium" style={{ background: 'var(--status-t7-bg)', color: 'var(--status-t7-fg)' }}>
                            Your step: {r.doc.stageLabel} ({r.doc.stage}/{r.doc.totalStages})
                          </span>
                        </td>
                        <td className={cn(TD_CLS, 'text-right')}>
                          <Button size="sm" onClick={() => setReviewing(r.doc)}>Review</Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={cn(TD_CLS, 'max-w-[300px]')}>
                          <span className="block truncate text-[13px] font-medium text-ui-heading">{hrSummary(r.hr)}</span>
                          {r.hr.description && <span className="block truncate text-ui-text-secondary" title={r.hr.description}>{r.hr.description}</span>}
                        </td>
                        <td className={TD_CLS}>{r.person}</td>
                        <td className={TD_CLS}>{SOURCE_LABEL.hr}</td>
                        <td className={cn(TD_CLS, 'whitespace-nowrap')}>{formatDate(r.at)}</td>
                        <td className={TD_CLS}>
                          <span className="inline-flex rounded-[4px] px-2 py-0.5 font-medium" style={{ background: 'var(--status-t7-bg)', color: 'var(--status-t7-fg)' }}>Pending</span>
                        </td>
                        <td className={cn(TD_CLS, 'whitespace-nowrap text-right')}>
                          <div className="inline-flex gap-1.5">
                            <Button size="sm" variant="secondary" onClick={() => { setNote(''); setDeciding({ row: r.hr, action: 'reject' }); }}>Reject</Button>
                            <Button size="sm" onClick={() => { setNote(''); setDeciding({ row: r.hr, action: 'approve' }); }}>Approve</Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {hrNote && <p className="m-0 text-[12px] text-ui-text-secondary">HR requests: {hrNote}</p>}

      {reviewing && (
        <ApprovalReviewDialog
          key={reviewing.approvalId}
          subtitle={`${reviewing.projectName} - ${reviewing.projectCode}`}
          title={`${DOC_LABELS[reviewing.docType] ?? reviewing.docType} - V${reviewing.versionNum ?? reviewing.version}`}
          chips={<span className="inline-flex rounded-[4px] px-2 py-0.5 text-[12px] font-medium" style={{ background: 'var(--status-t7-bg)', color: 'var(--status-t7-fg)' }}>Your step: {reviewing.stageLabel}</span>}
          approval={{
            approvalId: reviewing.approvalId, projectId: reviewing.projectId, fileName: reviewing.fileName, isFinalStage: reviewing.isFinalStage,
            versionNum: reviewing.versionNum, version: reviewing.version, stage: reviewing.stage, totalStages: reviewing.totalStages, stageLabel: reviewing.stageLabel,
          }}
          previewUrl={`/api/files/proxy/${encodeURIComponent(reviewing.fileName)}?documentId=${reviewing.documentId}`}
          uploadedLabel={`sent for approval ${formatDate(reviewing.createdAt)}`}
          userSignature={signature}
          onNeedSignature={resume => { resumeRef.current = resume; setSigning(true); }}
          onPdfSigned={() => {}}
          onDone={() => { setReviewing(null); afterAction(); }}
          onClose={() => setReviewing(null)}
        />
      )}
      {signing && (
        <SignaturePad
          existingBase64={signature ?? null}
          onSaved={base64 => {
            setSignature(base64);
            setSigning(false);
            const resume = resumeRef.current;
            resumeRef.current = null;
            if (resume) setTimeout(resume, 50);
          }}
          onClose={() => { setSigning(false); resumeRef.current = null; }}
        />
      )}
      <ConfirmModal
        open={!!deciding}
        onOpenChange={o => { if (!o) setDeciding(null); }}
        title={deciding?.action === 'approve' ? 'Approve this request?' : 'Reject this request?'}
        description={deciding ? `${hr?.names[deciding.row.user_id] ?? 'Team member'} · ${hrSummary(deciding.row)}` : undefined}
        tone={deciding?.action === 'reject' ? 'destructive' : 'default'}
        confirmLabel={deciding?.action === 'approve' ? 'Approve' : 'Reject'}
        onConfirm={decideHr}
      >
        <label className="flex flex-col gap-1 text-[12px] font-medium text-ui-body">
          {deciding?.action === 'reject' ? 'Reason (required)' : 'Note (optional)'}
          <Textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={1000} />
        </label>
      </ConfirmModal>
    </div>
  );
}
