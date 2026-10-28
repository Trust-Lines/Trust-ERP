'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, Eye, Hourglass, MessageSquareQuote, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmModal } from '@/components/ui/modal';
import { StatCard } from '@/components/platform/shared/StatCard';
import { formatDate } from '@/lib/formatDate';
import { cn } from '@/lib/utils';
import { HEADING } from '../designShared';
import { LibraryHeader } from './LibraryShell';

interface Review {
  id: string; status: 'active' | 'completed' | 'revoked' | 'expired'; decision: 'approved' | 'rejected' | 'revision_requested' | null;
  view_count: number; first_opened_at: string | null; completed_at: string | null; expires_at: string | null; created_at: string;
  job_id: string | null; job_title: string; version_no: number | null; designer: string | null; sent_by: string | null;
  feedback: string | null; feedback_by: string | null;
}
type Filter = 'waiting' | 'decided' | 'closed' | 'all';

/** One state for the badge: the decision when there is one, else whether the customer opened it. */
function reviewState(r: Review): string {
  if (r.decision) return r.decision;
  if (r.status === 'revoked' || r.status === 'expired') return r.status;
  if (r.expires_at && Date.parse(r.expires_at) < Date.now()) return 'expired';
  return r.first_opened_at ? 'opened' : 'waiting';
}
const isWaiting = (r: Review) => ['waiting', 'opened'].includes(reviewState(r));
const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));

export function CustomerReviewsClient() {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [filter, setFilter] = useState<Filter>('waiting');
  const [revoking, setRevoking] = useState<Review | null>(null);
  // Day counts depend on "now" — computed after mount so server and browser render the same.
  const [ready, setReady] = useState(false);

  async function load() {
    const res = await fetch('/api/design/reviews').catch(() => null);
    const b = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { toast.error(b.error ?? 'Could not load the reviews'); setReviews([]); return; }
    setReviews(b.reviews ?? []); setIsManager(!!b.isManager); setReady(true);
  }
  useEffect(() => { void load(); }, []);

  const all = useMemo(() => reviews ?? [], [reviews]);
  const counts = useMemo(() => ({
    waiting: all.filter(r => reviewState(r) === 'waiting').length,
    opened: all.filter(r => reviewState(r) === 'opened').length,
    approved: all.filter(r => r.decision === 'approved').length,
    revision: all.filter(r => r.decision === 'revision_requested' || r.decision === 'rejected').length,
  }), [all]);
  const visible = useMemo(() => all.filter(r => {
    if (filter === 'waiting') return isWaiting(r);
    if (filter === 'decided') return !!r.decision;
    if (filter === 'closed') return !r.decision && !isWaiting(r);
    return true;
  }), [all, filter]);

  async function revoke(r: Review) {
    const res = await fetch('/api/design/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'revoke', linkId: r.id }) }).catch(() => null);
    const b = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { toast.error(b.error ?? 'Could not revoke'); return; }
    toast.success('Link revoked — the customer can no longer open it');
    void load();
  }

  return (
    <div className="flex w-full flex-col gap-[30px] pb-12">
      <LibraryHeader crumb="Design / Customer Reviews" title="Customer Reviews"
        subtitle="Every design proposal sent to a customer: did they open it, what did they decide, how long has it been waiting. Links are sent from a job's Versions tab." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Hourglass} label="Not opened yet" value={counts.waiting} active={filter === 'waiting'} onClick={() => setFilter('waiting')} />
        <StatCard icon={Eye} label="Opened, no answer" value={counts.opened} active={filter === 'waiting'} onClick={() => setFilter('waiting')} />
        <StatCard icon={BadgeCheck} label="Approved" value={counts.approved} active={filter === 'decided'} onClick={() => setFilter('decided')} />
        <StatCard icon={RotateCcw} label="Revision / rejected" value={counts.revision} active={filter === 'decided'} onClick={() => setFilter('decided')} />
      </div>

      <div className="flex flex-wrap gap-2">
        {([['waiting', 'Waiting for the customer'], ['decided', 'Decided'], ['closed', 'Revoked / expired'], ['all', 'All']] as [Filter, string][]).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
            className="h-9 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] text-ui-body hover:bg-ui-hover-bg aria-pressed:border-[var(--color-secondary-700)] aria-pressed:bg-ui-selected-bg aria-pressed:font-semibold dark:aria-pressed:border-ui-heading">{l}</button>
        ))}
      </div>

      {reviews === null ? <p className="m-0 text-[13px] text-ui-text-secondary">Loading…</p> : visible.length === 0 ? (
        <div className="rounded-[8px] bg-ui-surface p-5">
          <EmptyState icon={<MessageSquareQuote />} title={all.length ? 'Nothing here' : 'No proposals sent yet'}
            description={all.length ? 'Try another filter.' : 'When Sales sends an approved design to the customer (job → Versions → Send to customer), it shows up here.'} />
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 rounded-[8px] bg-ui-surface p-5">
          {visible.map(r => {
            const state = reviewState(r);
            const waitingDays = ready && isWaiting(r) ? daysSince(r.created_at) : null;
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[6px] bg-ui-surface-elevated px-5 py-3">
                <div className="flex min-w-[220px] flex-1 flex-col gap-0.5">
                  <span className={cn('text-[13px] font-semibold', HEADING)}>{r.job_title}{r.version_no != null ? ` · V${r.version_no}` : ''}</span>
                  <span className="text-[11px] text-ui-text-secondary">Sent {formatDate(r.created_at)}{r.sent_by ? ` by ${r.sent_by}` : ''}{r.designer ? ` · designer ${r.designer}` : ''}</span>
                  {r.feedback && <span className="mt-1 line-clamp-2 text-[12px] text-ui-body">“{r.feedback}”{r.feedback_by ? ` — ${r.feedback_by}` : ''}</span>}
                </div>
                <StatusBadge group="customer_review" status={state} size="sm" />
                <span className="w-[150px] text-[12px] text-ui-body">
                  {r.first_opened_at ? `Opened ${formatDate(r.first_opened_at)} · ${r.view_count} view${r.view_count === 1 ? '' : 's'}` : 'Not opened'}
                </span>
                <span className={cn('w-[110px] text-[12px]', waitingDays != null && waitingDays >= 7 ? 'font-semibold text-error-normal' : 'text-ui-text-secondary')}>
                  {waitingDays != null ? `${waitingDays} day${waitingDays === 1 ? '' : 's'} waiting` : r.completed_at ? `Answered ${formatDate(r.completed_at)}` : ''}
                </span>
                <div className="flex gap-2">
                  {r.job_id && <Link href={`/design?job=${r.job_id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>Open job</Link>}
                  {isManager && r.status === 'active' && !r.decision && <Button variant="ghost" size="sm" onClick={() => setRevoking(r)}>Revoke</Button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal open={!!revoking} onOpenChange={o => { if (!o) setRevoking(null); }} tone="destructive"
        title="Revoke this customer link?" description="The customer can no longer open the proposal. Send a new one from the job's Versions tab if needed." confirmLabel="Revoke"
        onConfirm={async () => { if (revoking) await revoke(revoking); setRevoking(null); }} />
    </div>
  );
}
