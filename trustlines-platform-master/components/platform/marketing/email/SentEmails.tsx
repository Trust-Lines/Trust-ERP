'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Eye, Mail, MousePointerClick, Search, Send, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { KpiCard } from '@/components/ui/kpi-card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/feedback-states';
import { StatusBadge } from '@/components/ui/status-badge';
import { Modal, ModalContent } from '@/components/ui/modal';
import { pct } from '@/lib/email/campaigns';
import { PANEL, TD_CLS, TH_CLS, fmtNumber, sendJson } from '../pr/shared';

// Email Campaigns → "Sent emails": how many emails went out, to how many people, by whom,
// and every single one (campaign or one-to-one) with what it said.

interface Row {
  id: string; kind: 'campaign' | 'direct'; campaign_id: string | null; prospect_id: string | null; sender_user_id: string | null;
  to_email: string; to_name: string | null; subject: string; status: string; error: string | null; sent_at: string | null;
  opened_at: string | null; open_count: number; clicked_at: string | null; click_count: number; unsubscribed_at: string | null; created_at: string;
}
interface Summary {
  days: number; sent: number; recipients: number; direct: number; campaign: number; opened: number; clicked: number;
  unsubscribed: number; failed: number; queued: number; bySender: { id: string; name: string; sent: number }[];
}
interface Data { summary: Summary; emails: Row[]; total: number; pageSize: number; senders: Record<string, string>; campaigns: Record<string, string>; seeAll: boolean }
interface Detail { email: Row & { body_html: string | null }; campaignName: string | null; events: { type: string; url: string | null; created_at: string }[] }

const PERIODS = [{ value: '7d', label: 'Last 7 days' }, { value: '30d', label: 'Last 30 days' }, { value: '90d', label: 'Last 90 days' }, { value: '365d', label: 'Last 12 months' }];
const KINDS = [{ value: '', label: 'All emails' }, { value: 'campaign', label: 'Campaign emails' }, { value: 'direct', label: 'One-to-one emails' }];
const STATUSES = [
  { value: '', label: 'Any status' }, { value: 'sent', label: 'Delivered' }, { value: 'opened', label: 'Opened' }, { value: 'clicked', label: 'Clicked' },
  { value: 'unsubscribed', label: 'Unsubscribed' }, { value: 'failed', label: 'Failed' }, { value: 'queued', label: 'Waiting to send' },
];
const WHEN = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const rate = (v: number | null) => (v === null ? '—' : `${v}%`);

export function SentEmails() {
  const [period, setPeriod] = useState('30d');
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [sender, setSender] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Detail | null>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ period, kind, status, sender, q: query, page: String(page) });
    try {
      setData(await sendJson<Data>(`/api/marketing/email-messages?${p}`, 'GET'));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the emails');
    }
  }, [period, kind, status, sender, query, page]);
  useEffect(() => { const t = setTimeout(load, query ? 300 : 0); return () => clearTimeout(t); }, [load, query]);

  async function show(id: string) {
    try { setOpen(await sendJson<Detail>(`/api/marketing/email-messages/${id}`, 'GET')); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not open the email'); }
  }
  const reset = (fn: () => void) => { fn(); setPage(1); };

  if (error && !data) return <div className={cn(PANEL, 'p-6')}><ErrorState title="Sent emails aren’t available" description={error} /></div>;
  const s = data?.summary;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[12px] text-ui-text-secondary">
          {data?.seeAll ? 'Every email the team sent from the ERP.' : 'The emails you sent from the ERP.'} Test emails aren’t counted.
        </p>
        <Select className="h-10 w-[170px] text-[13px]" aria-label="Period" value={period} options={PERIODS} onValueChange={v => reset(() => setPeriod(v ?? '30d'))} />
      </div>

      <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={<Send />} label="Emails delivered" value={s ? fmtNumber(s.sent) : '—'} loading={!s}
          badge={s ? { label: `${fmtNumber(s.campaign)} campaign · ${fmtNumber(s.direct)} one-to-one`, tone: 'neutral' } : undefined} />
        <KpiCard icon={<Users />} label="People reached" value={s ? fmtNumber(s.recipients) : '—'} loading={!s}
          badge={s && (s.failed || s.queued) ? { label: `${s.failed} failed · ${s.queued} waiting`, tone: s.failed ? 'error' : 'neutral' } : undefined} />
        <KpiCard icon={<Eye />} label="Opened" value={s ? rate(pct(s.opened, s.sent)) : '—'} loading={!s} badge={s ? { label: `${fmtNumber(s.opened)} emails`, tone: 'neutral' } : undefined} />
        <KpiCard icon={<MousePointerClick />} label="Clicked" value={s ? rate(pct(s.clicked, s.sent)) : '—'} loading={!s}
          badge={s ? { label: `${fmtNumber(s.clicked)} emails${s.unsubscribed ? ` · ${s.unsubscribed} unsubscribed` : ''}`, tone: 'neutral' } : undefined} />
      </div>

      {s && data?.seeAll && s.bySender.length > 0 && (
        <section className={cn(PANEL, 'p-6')}>
          <h2 className="m-0 mb-3 text-[15px] font-semibold text-ui-heading">Who sent them</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {s.bySender.map(p => (
              <li key={p.id} className="flex items-center gap-3 text-[13px]">
                <button type="button" onClick={() => reset(() => setSender(sender === p.id ? '' : p.id))}
                  className={cn('w-[200px] shrink-0 cursor-pointer truncate border-0 bg-transparent p-0 text-left hover:underline', sender === p.id ? 'font-semibold text-ui-heading' : 'text-ui-body')}>
                  {p.name}
                </button>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ui-hover-bg">
                  <div className="h-full rounded-full bg-[var(--color-secondary-700)]" style={{ width: `${Math.max(2, (p.sent / s.bySender[0].sent) * 100)}%` }} />
                </div>
                <span className="w-[60px] shrink-0 text-right tabular-nums">{fmtNumber(p.sent)}</span>
              </li>
            ))}
          </ul>
          {sender && <Button size="sm" variant="ghost" className="mt-2" onClick={() => reset(() => setSender(''))}>Show everyone</Button>}
        </section>
      )}

      <section className={cn(PANEL, 'flex flex-col gap-4 p-6')}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-[300px]">
            <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" aria-hidden />
            <Input className="h-10 pl-8 text-[13px]" placeholder="Search recipient or subject…" value={query} onChange={e => reset(() => setQuery(e.target.value))} aria-label="Search emails" />
          </div>
          <Select className="h-10 w-[180px] text-[13px]" aria-label="Kind" value={kind} options={KINDS} onValueChange={v => reset(() => setKind(v ?? ''))} />
          <Select className="h-10 w-[170px] text-[13px]" aria-label="Status" value={status} options={STATUSES} onValueChange={v => reset(() => setStatus(v ?? ''))} />
          {data && <span className="ml-auto text-[12px] text-ui-text-secondary">{fmtNumber(data.total)} emails</span>}
        </div>

        {!data ? <p className="m-0 text-[13px] text-ui-text-secondary">Loading…</p> : data.emails.length === 0 ? (
          <EmptyState icon={<Mail />} title="No emails in this view" description="Emails sent from Contacts and email campaigns show up here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead><tr className="border-b border-ui-divider">
                <th className={TH_CLS}>Recipient</th><th className={TH_CLS}>Email</th><th className={TH_CLS}>From</th>
                <th className={TH_CLS}>Status</th><th className={cn(TH_CLS, 'text-right')}>Opens</th><th className={cn(TH_CLS, 'text-right')}>Clicks</th><th className={TH_CLS}>Sent</th>
              </tr></thead>
              <tbody>
                {data.emails.map(e => (
                  <tr key={e.id} className="cursor-pointer border-b border-ui-divider last:border-b-0 hover:bg-ui-hover-bg" onClick={() => show(e.id)}>
                    <td className={TD_CLS}>
                      <div className="max-w-[220px] truncate font-medium text-ui-heading">{e.to_name || e.to_email}</div>
                      {e.to_name && <div className="max-w-[220px] truncate text-ui-text-secondary">{e.to_email}</div>}
                    </td>
                    <td className={TD_CLS}>
                      <div className="max-w-[300px] truncate">{e.subject}</div>
                      <div className="max-w-[300px] truncate text-ui-text-secondary">
                        {e.kind === 'campaign' ? `Campaign · ${data.campaigns[e.campaign_id ?? ''] ?? '—'}` : 'One-to-one'}
                      </div>
                    </td>
                    <td className={cn(TD_CLS, 'whitespace-nowrap')}>{e.sender_user_id ? data.senders[e.sender_user_id] ?? '—' : '—'}</td>
                    <td className={TD_CLS}>
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <StatusBadge group="email_message" status={e.status} size="sm" />
                        {e.unsubscribed_at && <span className="rounded-tag bg-warning-light px-1.5 text-[11px] text-warning-dark">Unsubscribed</span>}
                      </span>
                    </td>
                    <td className={cn(TD_CLS, 'text-right tabular-nums')}>{e.open_count || '—'}</td>
                    <td className={cn(TD_CLS, 'text-right tabular-nums')}>{e.click_count || '—'}</td>
                    <td className={cn(TD_CLS, 'whitespace-nowrap')}>{WHEN.format(new Date(e.sent_at ?? e.created_at))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 text-[12px]">
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="tabular-nums">Page {page} of {pages}</span>
            <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </section>

      <Modal open={!!open} onOpenChange={o => { if (!o) setOpen(null); }}>
        {open && (
          <ModalContent size="lg" title={open.email.subject}
            description={`To ${open.email.to_name ? `${open.email.to_name} <${open.email.to_email}>` : open.email.to_email}${open.email.sent_at ? ` · ${WHEN.format(new Date(open.email.sent_at))}` : ''}`}>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <StatusBadge group="email_message" status={open.email.status} size="sm" />
                {open.email.opened_at && <span className="inline-flex items-center gap-1"><Eye size={13} /> Opened {open.email.open_count}×</span>}
                {open.email.clicked_at && <span className="inline-flex items-center gap-1"><MousePointerClick size={13} /> Clicked {open.email.click_count}×</span>}
                {open.email.prospect_id && <Link href={`/marketing/prospects/${open.email.prospect_id}?tab=activities`} className="text-ui-link hover:underline">Open the Contact</Link>}
                {open.email.campaign_id && <Link href={`/marketing/email/${open.email.campaign_id}`} className="text-ui-link hover:underline">Open the campaign{open.campaignName ? ` “${open.campaignName}”` : ''}</Link>}
              </div>
              {open.email.error && <div role="alert" className="rounded-[6px] bg-error-light px-3 py-2 text-[12px] text-error-dark">{open.email.error}</div>}
              {open.email.kind === 'campaign' && <p className="m-0 text-[11px] text-ui-text-secondary">Campaign content — each recipient got it with their own name and details in the {'{{merge}}'} fields.</p>}
              {open.email.body_html
                // Sandboxed: shown, never run.
                ? <iframe title="Email" sandbox="" srcDoc={open.email.body_html} className="h-[420px] w-full rounded-[6px] border border-ui-divider bg-white" />
                : <p className="m-0 text-[13px] text-ui-text-secondary">The content of this email wasn’t kept.</p>}
              {open.events.some(ev => ev.type === 'click') && (
                <div className="text-[12px]">
                  <div className="mb-1 font-medium">Links clicked</div>
                  <ul className="m-0 list-disc pl-5">
                    {open.events.filter(ev => ev.type === 'click').map((ev, i) => <li key={i} className="break-all">{ev.url} <span className="text-ui-text-secondary">· {WHEN.format(new Date(ev.created_at))}</span></li>)}
                  </ul>
                </div>
              )}
            </div>
          </ModalContent>
        )}
      </Modal>
    </div>
  );
}
