'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { PANEL, TD_CLS, TH_CLS, fmtNumber } from '@/components/platform/marketing/pr/shared';
import { RECIPIENTS_PER_PAGE, RECIPIENT_FILTERS, WHEN, type Recipient } from './campaignData';

/** Filterable, paged recipients table. `mounted` gates locale-formatted dates to avoid hydration mismatch. */
export function RecipientsTable({ recipients, total, page, onPageChange, filter, onFilterChange, mounted }: {
  recipients: Recipient[];
  total: number;
  page: number;
  onPageChange: (p: number) => void;
  filter: string;
  onFilterChange: (f: string) => void;
  mounted: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / RECIPIENTS_PER_PAGE));
  return (
    <section className={cn(PANEL, 'flex flex-col gap-4 p-6')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-[15px] font-semibold text-ui-heading">Recipients <span className="text-[12px] font-normal text-ui-text-secondary">({fmtNumber(total)})</span></h2>
        <Select className="w-[180px]" aria-label="Show" value={filter} options={RECIPIENT_FILTERS} onValueChange={v => onFilterChange(v ?? '')} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead><tr className="border-b border-ui-divider">
            <th className={TH_CLS}>Recipient</th><th className={TH_CLS}>Status</th><th className={cn(TH_CLS, 'text-right')}>Opens</th><th className={cn(TH_CLS, 'text-right')}>Clicks</th><th className={TH_CLS}>Sent</th>
          </tr></thead>
          <tbody>
            {recipients.map(r => (
              <tr key={r.id} className="border-b border-ui-divider last:border-b-0">
                <td className={TD_CLS}>
                  {r.prospect_id ? <Link href={`/marketing/prospects/${r.prospect_id}?tab=activities`} className="text-ui-link hover:underline">{r.to_name || r.to_email}</Link> : (r.to_name || r.to_email)}
                  {r.to_name && <span className="block text-ui-text-secondary">{r.to_email}</span>}
                </td>
                <td className={TD_CLS}>
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <StatusBadge group="email_message" status={r.status} size="sm" />
                    {r.unsubscribed_at && <span className="rounded-tag bg-warning-light px-1.5 text-[11px] text-warning-dark">Unsubscribed</span>}
                  </span>
                  {r.error && <span className="block max-w-[260px] truncate text-[11px] text-error-dark" title={r.error}>{r.error}</span>}
                </td>
                <td className={cn(TD_CLS, 'text-right tabular-nums')}>{r.open_count || '—'}</td>
                <td className={cn(TD_CLS, 'text-right tabular-nums')}>{r.click_count || '—'}</td>
                <td className={cn(TD_CLS, 'whitespace-nowrap')}>{mounted && r.sent_at ? WHEN.format(new Date(r.sent_at)) : '—'}</td>
              </tr>
            ))}
            {!recipients.length && <tr><td colSpan={5} className={cn(TD_CLS, 'text-center text-ui-text-secondary')}>Nobody in this view.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-[12px]">
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
          <span className="tabular-nums">Page {page} of {pages}</span>
          <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Next</Button>
        </div>
      )}
    </section>
  );
}
