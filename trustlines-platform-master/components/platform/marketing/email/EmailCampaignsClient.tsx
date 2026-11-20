'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Ban, MailOpen, MousePointerClick, Plus, Search, Send, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmModal, Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { pct, type CampaignStats, type EmailCampaignRow } from '@/lib/email/campaigns';
import { PANEL, TD_CLS, TH_CLS, fmtNumber, sendJson } from '../pr/shared';
import { PageHeading } from '@/components/platform/shared/PageHeading';
import { Field } from '@/components/ui/field';
import { SentEmails } from './SentEmails';
import { CampaignList } from './CampaignList';

interface Suppression { email: string; reason: string; note: string | null; created_at: string }

const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const REASON: Record<string, string> = { unsubscribed: 'Unsubscribed', bounced: 'Bounced', complaint: 'Marked as spam', manual: 'Added by hand' };
const rateText = (v: number | null) => (v === null ? '—' : `${v}%`);
const DAY_MS = 86_400_000;

// No mail-clock in the installed lucide-react: the Figma export (public/icons/mail-clock.svg)
// drawn as a mask so it takes the card's text colour in light and dark.
const MAIL_CLOCK: CSSProperties = { mask: 'url(/icons/mail-clock.svg) center / contain no-repeat', WebkitMask: 'url(/icons/mail-clock.svg) center / contain no-repeat' };

// Figma "Email Campaigns" (990:15405): heading, four tinted KPI cards, view tabs, then the tab.
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

  // Cards cover campaigns started in the last 30 days; the "+N New" badge counts the last 7.
  const kpi = useMemo(() => {
    const now = Date.now();
    const within = (at: string | null, days: number) => !!at && new Date(at).getTime() >= now - days * DAY_MS;
    const all = campaigns ?? [];
    const recent = all.filter(c => within(c.started_at, 30));
    const sum = (k: keyof CampaignStats) => recent.reduce((s, c) => s + Number(stats[c.id]?.[k] ?? 0), 0);
    const sent = sum('sent');
    const live = all.filter(c => c.status === 'sending' || c.status === 'scheduled');
    return {
      sent, open: pct(sum('opened'), sent), click: pct(sum('clicked'), sent), sending: live.length,
      newStarted: all.filter(c => within(c.started_at, 7)).length,
      newLive: live.filter(c => within(c.created_at, 7)).length,
    };
  }, [campaigns, stats]);

  const loading = !campaigns;
  return (
    <div className="flex flex-col gap-[18px]">
      <PageHeading
        trail={[{ label: 'Marketing', href: '/marketing' }, { label: 'Email Campaigns', href: '/marketing/email' }]}
        title="Email Campaigns"
        subtitle="Used from Contacts to download or send a query’s results as one merged mailing."
        actions={canEdit && <Button variant="accent" loading={creating} onClick={create}><Plus /> New Campaign</Button>}
      />

      {!mailReady && canEdit && (
        <div role="note" className="flex flex-wrap items-center gap-2 rounded-[6px] bg-warning-light px-3 py-2.5 text-[12px] text-warning-dark">
          Your mailbox isn’t connected yet — campaigns are sent from it. <a href="/settings" className="font-semibold underline">Settings → Email sending</a>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <EmailKpi tone="c4" label="Emails sent" value={fmtNumber(kpi.sent)} icon={<Send />} fresh={kpi.newStarted} note="In 30 days" loading={loading} />
        <EmailKpi tone="c3" label="Open rate" value={rateText(kpi.open)} icon={<MailOpen />} fresh={kpi.newStarted} note="In 30 days" loading={loading} />
        <EmailKpi tone="c5" label="Click rate" value={rateText(kpi.click)} icon={<MousePointerClick />} fresh={kpi.newStarted} note="In 30 days" loading={loading} />
        <EmailKpi tone="c2" label="Sending or scheduled" value={fmtNumber(kpi.sending)} icon={<span className="block size-full bg-current" style={MAIL_CLOCK} />}
          fresh={kpi.newLive} note="Right now" loading={loading} />
      </div>

      <nav aria-label="Email views" className="flex h-12 items-stretch gap-8 border-b border-ui-divider">
        {([['campaigns', 'Campaigns'], ['sent', 'Sent Emails'], ['suppressed', 'Black-list']] as const).map(([key, label]) => (
          <button key={key} type="button" aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}
            className={cn('-mb-px flex items-center gap-1.5 border-0 border-b-[3px] bg-transparent p-0 text-[13px] leading-[1.4]',
              tab === key ? 'border-[var(--color-secondary-700)] font-semibold text-[var(--color-secondary-700)] dark:border-ui-heading dark:text-ui-heading'
                : 'cursor-pointer border-transparent text-ui-text-secondary hover:text-ui-body')}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'sent' ? <SentEmails /> : tab === 'suppressed' ? <SuppressionList canEdit={canEdit} isManager={isManager} /> : (
        <CampaignList campaigns={campaigns} stats={stats} error={error} canEdit={canEdit} mounted={mounted}
          creating={creating} onCreate={create} onChanged={load} />
      )}
    </div>
  );
}

/** Figma tinted KPI card (Process C2–C5): uppercase label, "+N New" badge, big number + icon, note. */
function EmailKpi({ tone, label, value, icon, fresh, note, loading }: {
  tone: 'c2' | 'c3' | 'c4' | 'c5'; label: string; value: ReactNode; icon: ReactNode; fresh: number; note: string; loading: boolean;
}) {
  const fg = `var(--process-${tone}-fg)`;
  const bg = `var(--process-${tone}-bg)`;
  return (
    <section aria-label={label} className="flex flex-col gap-2 rounded-[11px] border border-ui-divider px-4 py-[14px]" style={{ background: bg, color: fg }}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="m-0 text-[12px] font-medium uppercase leading-[1.5] tracking-[-0.264px]">{label}</h2>
        {!loading && fresh > 0 && (
          <span title="Started in the last 7 days" className="inline-flex h-[18px] shrink-0 items-center rounded-[4px] px-2 text-[10px] font-medium tracking-[0.4px]" style={{ background: fg, color: bg }}>
            +{fresh} New
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {loading ? <Skeleton className="h-[29px] w-24" /> : (
          <div className="flex items-center gap-1">
            <span className="text-[36px] font-semibold leading-[29px] tracking-[0.72px] tabular-nums">{value}</span>
            <span aria-hidden className="grid size-[29px] shrink-0 place-items-center [&_svg]:size-[29px] [&_svg]:stroke-[1.75]">{icon}</span>
          </div>
        )}
        <p className="m-0 text-[10px] leading-[1.5] tracking-[-0.22px] opacity-50">{note}</p>
      </div>
    </section>
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
          <Input className="h-10 pl-8 dark:pl-8 text-[13px]" placeholder="Search addresses…" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search addresses" />
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
            <Field label="Email address" htmlFor="sup-email" className="[&>label]:text-[14px]"><Input id="sup-email" type="email" className="h-10 text-[14px]" value={email} onChange={e => setEmail(e.target.value)} /></Field>
            <Field label="Note (optional)" htmlFor="sup-note" className="[&>label]:text-[14px]"><Input id="sup-note" className="h-10 text-[14px]" value={note} placeholder="e.g. asked by phone not to be emailed" onChange={e => setNote(e.target.value)} /></Field>
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
