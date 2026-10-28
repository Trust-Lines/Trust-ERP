'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Ban, Eye, MailOpen, MousePointerClick, Plus, Search, Send, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/feedback-states';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmModal, Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { pct, type CampaignStats, type EmailCampaignRow } from '@/lib/email/campaigns';
import { Field, PANEL, PageHeading, TD_CLS, TH_CLS, fmtNumber, sendJson } from '../pr/shared';
import { SentEmails } from './SentEmails';

interface Suppression { email: string; reason: string; note: string | null; created_at: string }

const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const REASON: Record<string, string> = { unsubscribed: 'Unsubscribed', bounced: 'Bounced', complaint: 'Marked as spam', manual: 'Added by hand' };
const rateText = (v: number | null) => (v === null ? '—' : `${v}%`);

export function EmailCampaignsClient({ canEdit, isManager, mailReady }: { canEdit: boolean; isManager: boolean; mailReady: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<'campaigns' | 'sent' | 'suppressed'>('campaigns');
  const [campaigns, setCampaigns] = useState<EmailCampaignRow[] | null>(null);
  const [stats, setStats] = useState<Record<string, CampaignStats>>({});
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    try {
      const b = await sendJson<{ campaigns: EmailCampaignRow[]; stats: Record<string, CampaignStats> }>('/api/marketing/email-campaigns', 'GET');
      setCampaigns(b.campaigns); setStats(b.stats); setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load campaigns'); setCampaigns([]);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create() {
    setCreating(true);
    try {
      const { campaign } = await sendJson<{ campaign: EmailCampaignRow }>('/api/marketing/email-campaigns', 'POST', {});
      router.push(`/marketing/email/${campaign.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the campaign');
      setCreating(false);
    }
  }

  const kpi = useMemo(() => {
    const since = Date.now() - 30 * 86_400_000;
    const recent = (campaigns ?? []).filter(c => c.started_at && new Date(c.started_at).getTime() >= since);
    const sum = (k: keyof CampaignStats) => recent.reduce((s, c) => s + Number(stats[c.id]?.[k] ?? 0), 0);
    const sent = sum('sent');
    return {
      sent, open: pct(sum('opened'), sent), click: pct(sum('clicked'), sent),
      sending: (campaigns ?? []).filter(c => c.status === 'sending' || c.status === 'scheduled').length,
    };
  }, [campaigns, stats]);

  return (
    <div className="flex flex-col gap-[30px]">
      <PageHeading
        trail="Marketing / Email Campaigns"
        title="Email Campaigns"
        subtitle="Send a designed email to a Contacts audience from your own mailbox, then follow opens, clicks and unsubscribes."
        actions={canEdit && <Button loading={creating} onClick={create}><Plus /> New campaign</Button>}
      />

      {!mailReady && canEdit && (
        <div role="note" className="flex flex-wrap items-center gap-2 rounded-[6px] bg-warning-light px-3 py-2.5 text-[12px] text-warning-dark">
          Your mailbox isn’t connected yet — campaigns are sent from it. <a href="/settings" className="font-semibold underline">Settings → Email sending</a>
        </div>
      )}

      <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={<Send />} label="Emails sent (30 days)" value={fmtNumber(kpi.sent)} loading={!campaigns} />
        <KpiCard icon={<Eye />} label="Open rate (30 days)" value={rateText(kpi.open)} loading={!campaigns} />
        <KpiCard icon={<MousePointerClick />} label="Click rate (30 days)" value={rateText(kpi.click)} loading={!campaigns} />
        <KpiCard icon={<MailOpen />} label="Sending or scheduled" value={kpi.sending} loading={!campaigns} />
      </div>

      <nav aria-label="Email views" className="flex h-12 items-stretch gap-8 border-b border-ui-divider">
        {([['campaigns', 'Campaigns'], ['sent', 'Sent emails'], ['suppressed', 'Do-not-email list']] as const).map(([key, label]) => (
          <button key={key} type="button" aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}
            className={cn('flex items-center gap-1.5 border-0 border-b-[3px] bg-transparent p-0 text-[13px] leading-[1.4]',
              tab === key ? 'border-[var(--color-secondary-700)] font-semibold text-[var(--color-secondary-700)] dark:border-ui-heading dark:text-ui-heading'
                : 'cursor-pointer border-transparent text-ui-text-secondary hover:text-ui-body')}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'sent' ? <SentEmails /> : tab === 'suppressed' ? <SuppressionList canEdit={canEdit} isManager={isManager} /> : (
        <div className={cn(PANEL, 'p-6')}>
          {error ? <ErrorState title="Campaigns aren’t available" description={error} />
            : campaigns === null ? <p className="m-0 text-[13px] text-ui-text-secondary">Loading…</p>
              : campaigns.length === 0 ? (
                <EmptyState icon={<MailOpen />} title="No email campaigns yet"
                  description="Pick an audience from Contacts, design the email from a template, send yourself a test, then send or schedule it."
                  action={canEdit ? <Button onClick={create}><Plus /> New campaign</Button> : undefined} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] border-collapse">
                    <thead><tr className="border-b border-ui-divider">
                      <th className={TH_CLS}>Campaign</th><th className={TH_CLS}>Status</th>
                      <th className={cn(TH_CLS, 'text-right')}>Recipients</th><th className={cn(TH_CLS, 'text-right')}>Sent</th>
                      <th className={cn(TH_CLS, 'text-right')}>Opened</th><th className={cn(TH_CLS, 'text-right')}>Clicked</th>
                      <th className={cn(TH_CLS, 'text-right')}>Unsubscribed</th><th className={TH_CLS}>Date</th>
                    </tr></thead>
                    <tbody>
                      {campaigns.map(c => {
                        const s = stats[c.id];
                        const sent = Number(s?.sent ?? 0);
                        const when = c.finished_at ?? c.started_at ?? c.scheduled_at ?? c.created_at;
                        return (
                          <tr key={c.id} className="cursor-pointer border-b border-ui-divider last:border-b-0 hover:bg-ui-hover-bg" onClick={() => router.push(`/marketing/email/${c.id}`)}>
                            <td className={TD_CLS}>
                              <div className="max-w-[320px] truncate text-[13px] font-semibold text-ui-heading">{c.name}</div>
                              <div className="max-w-[320px] truncate text-ui-text-secondary">{c.subject || 'No subject yet'}</div>
                            </td>
                            <td className={TD_CLS}><StatusBadge group="email_campaign" status={c.status} size="sm" /></td>
                            <td className={cn(TD_CLS, 'text-right tabular-nums')}>{c.recipient_count ? fmtNumber(c.recipient_count) : '—'}</td>
                            <td className={cn(TD_CLS, 'text-right tabular-nums')}>{s ? fmtNumber(sent) : '—'}</td>
                            <td className={cn(TD_CLS, 'text-right tabular-nums')}>{s && sent ? rateText(pct(Number(s.opened), sent)) : '—'}</td>
                            <td className={cn(TD_CLS, 'text-right tabular-nums')}>{s && sent ? rateText(pct(Number(s.clicked), sent)) : '—'}</td>
                            <td className={cn(TD_CLS, 'text-right tabular-nums')}>{s ? fmtNumber(Number(s.unsubscribed)) : '—'}</td>
                            <td className={cn(TD_CLS, 'whitespace-nowrap')}>
                              {mounted ? `${c.status === 'scheduled' ? 'Scheduled ' : ''}${DAY.format(new Date(when))}` : ''}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
        </div>
      )}
    </div>
  );
}

function SuppressionList({ canEdit, isManager }: { canEdit: boolean; isManager: boolean }) {
  const [rows, setRows] = useState<Suppression[] | null>(null);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [removing, setRemoving] = useState<Suppression | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async (q: string) => {
    try {
      const b = await sendJson<{ suppressions: Suppression[] }>(`/api/marketing/email-suppressions?q=${encodeURIComponent(q)}`, 'GET');
      setRows(b.suppressions);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load'); setRows([]);
    }
  }, []);
  useEffect(() => { const t = setTimeout(() => load(query), 250); return () => clearTimeout(t); }, [query, load]);

  async function add() {
    try {
      await sendJson('/api/marketing/email-suppressions', 'POST', { email, note });
      toast.success('Added — this address won’t be emailed');
      setAdding(false); setEmail(''); setNote(''); load(query);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not add'); }
  }

  async function remove() {
    if (!removing) return;
    try {
      await sendJson('/api/marketing/email-suppressions', 'DELETE', { email: removing.email, reason });
      toast.success('Removed from the list'); setRemoving(null); setReason(''); load(query);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not remove'); throw e; }
  }

  return (
    <div className={cn(PANEL, 'flex flex-col gap-5 p-6')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-[320px]">
          <Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" aria-hidden />
          <Input className="h-10 pl-8 text-[13px]" placeholder="Search addresses…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search addresses" />
        </div>
        {canEdit && <Button variant="secondary" onClick={() => setAdding(true)}><Ban /> Add address</Button>}
      </div>
      <p className="m-0 text-[12px] text-ui-text-secondary">
        These addresses never get an email from the ERP — campaigns skip them and one-to-one sending is blocked. Unsubscribes are added automatically.
      </p>
      {rows === null ? <p className="m-0 text-[13px] text-ui-text-secondary">Loading…</p> : rows.length === 0 ? (
        <EmptyState icon={<Ban />} title={query ? 'No address matches' : 'Nobody has unsubscribed'} />
      ) : (
        <table className="w-full border-collapse">
          <thead><tr className="border-b border-ui-divider"><th className={TH_CLS}>Address</th><th className={TH_CLS}>Why</th><th className={TH_CLS}>Since</th><th className={TH_CLS}><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.email} className="border-b border-ui-divider last:border-b-0">
                <td className={TD_CLS}>{r.email}</td>
                <td className={TD_CLS}>{REASON[r.reason] ?? r.reason}{r.note ? ` · ${r.note}` : ''}</td>
                <td className={cn(TD_CLS, 'whitespace-nowrap')}>{DAY.format(new Date(r.created_at))}</td>
                <td className={cn(TD_CLS, 'text-right')}>
                  {isManager && <Button variant="ghost" size="icon-sm" aria-label={`Remove ${r.email}`} onClick={() => setRemoving(r)}><Trash2 className="text-error-normal" /></Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal open={adding} onOpenChange={setAdding}>
        <ModalContent title="Add to the do-not-email list" footer={(
          <><ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose><Button onClick={add}>Add address</Button></>
        )}>
          <div className="flex flex-col gap-4">
            <Field label="Email address" htmlFor="sup-email"><Input id="sup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} /></Field>
            <Field label="Note (optional)" htmlFor="sup-note"><Input id="sup-note" value={note} placeholder="e.g. asked by phone not to be emailed" onChange={e => setNote(e.target.value)} /></Field>
          </div>
        </ModalContent>
      </Modal>

      <ConfirmModal
        open={!!removing} onOpenChange={o => { if (!o) setRemoving(null); }}
        title="Email this address again?" description={removing?.email} tone="destructive" confirmLabel="Remove from list"
        warning={removing?.reason === 'unsubscribed' ? 'This person unsubscribed. Only remove them if they asked to be emailed again.' : undefined}
        onConfirm={remove}
      >
        <Field label="Why (kept in the audit log)" htmlFor="sup-reason">
          <Input id="sup-reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. asked to be re-added by email on Oct 27" />
        </Field>
      </ConfirmModal>
    </div>
  );
}
