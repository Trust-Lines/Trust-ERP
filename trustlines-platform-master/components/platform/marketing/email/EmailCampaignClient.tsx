'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft, Ban, CalendarClock, CircleAlert, Eye, FlaskConical, MousePointerClick, Pause, Play, Send, Trash2, Users, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { KpiCard } from '@/components/ui/kpi-card';
import { ErrorState } from '@/components/ui/feedback-states';
import { StatusBadge } from '@/components/ui/status-badge';
import { ConfirmModal } from '@/components/ui/modal';
import { MERGE_FIELDS } from '@/lib/marketing/mailTemplates';
import { pct, type CampaignStats, type EmailCampaignRow } from '@/lib/email/campaigns';
import type { Audience } from '@/lib/email/sender';
import { Field, PANEL, TD_CLS, TH_CLS, fmtNumber, sendJson, HEADING_TEXT } from '../pr/shared';

interface Option { value: string; label: string }
interface Recipient {
  id: string; prospect_id: string | null; to_email: string; to_name: string | null; status: string; error: string | null;
  sent_at: string | null; opened_at: string | null; open_count: number; clicked_at: string | null; click_count: number; unsubscribed_at: string | null;
}
interface Detail {
  campaign: EmailCampaignRow; stats: CampaignStats; recipients: Recipient[]; recipientTotal: number;
  topLinks: { url: string; clicks: number; people: number }[]; sender: { full_name: string | null; email: string } | null;
}
interface AudienceCount { matched: number; noEmail: number; suppressed: number; recipients: number; sample: string[] }
interface Template { id: string; name: string; subject: string; body_html: string }

interface Props {
  id: string;
  canEdit: boolean;
  isManager: boolean;
  userId: string;
  mailReady: boolean;
  marketingCampaigns: Option[];
  regions: Option[];
  sources: string[];
}

const STATUS_OPTIONS: Option[] = [
  { value: '', label: 'Any classification' }, { value: 'captured', label: 'No project yet' }, { value: 'potential', label: 'Potential' },
  { value: 'opportunity_candidate', label: 'Opportunity Candidate' }, { value: 'disqualified', label: 'Disqualified' },
];
const PROJECT_OPTIONS: Option[] = [
  { value: '', label: 'Any project status' }, { value: 'active', label: 'Has an active project' },
  { value: 'finished', label: 'Project finished' }, { value: 'none', label: 'Never had a project' },
];
const RECIPIENT_FILTERS: Option[] = [
  { value: '', label: 'Everyone' }, { value: 'sent', label: 'Delivered' }, { value: 'opened', label: 'Opened' }, { value: 'clicked', label: 'Clicked' },
  { value: 'unsubscribed', label: 'Unsubscribed' }, { value: 'failed', label: 'Failed' }, { value: 'queued', label: 'Waiting' }, { value: 'skipped', label: 'Skipped' },
];
const WHEN = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const SAMPLE: Record<string, string> = { name: 'Acme Retail', first_name: 'Jordan', company: 'Acme Retail', industry: 'Retail', region: 'T-Lines North East', state: 'GA', source: 'Trade Fair', email: 'jordan@example.com' };
const rateText = (v: number | null) => (v === null ? '—' : `${v}%`);
const editing = (c: EmailCampaignRow) => c.status === 'draft' || c.status === 'scheduled' || (c.status === 'paused' && !c.started_at);

/** Rough preview of the email shell the sender adds (lib/email/compose.ts wrapCampaign). */
function previewHtml(body: string, preheader: string | null) {
  const merged = body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (w, t: string) => SAMPLE[t.toLowerCase()] ?? w);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"></head><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
${preheader ? `<div style="font-size:11px;color:#6b7280;padding:8px 12px">Preview text: ${preheader.replace(/</g, '&lt;')}</div>` : ''}
<div style="max-width:600px;margin:16px auto;background:#fff;border-radius:8px;padding:28px;font-size:14px;line-height:1.6;color:#1f2937">${merged}</div>
<p style="max-width:600px;margin:0 auto 16px;font-size:11px;color:#6b7280;padding:0 12px">You received this email from … · <u>Unsubscribe</u> (added automatically)</p></body></html>`;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function EmailCampaignClient(props: Props) {
  const { id } = props;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    try {
      setDetail(await sendJson<Detail>(`/api/marketing/email-campaigns/${id}?page=${page}&filter=${filter}`, 'GET'));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the campaign');
    }
  }, [id, page, filter]);
  useEffect(() => { load(); }, [load]);

  // While it's sending, refresh the numbers every 15 seconds.
  const status = detail?.campaign.status;
  useEffect(() => {
    if (status !== 'sending') return;
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [status, load]);

  if (error && !detail) return <div className={cn(PANEL, 'p-6')}><ErrorState title="Campaign not available" description={error} /></div>;
  if (!detail) return <p className="text-[13px] text-ui-text-secondary">Loading…</p>;

  return editing(detail.campaign)
    ? <CampaignEditor {...props} campaign={detail.campaign} onChanged={load} />
    : <CampaignReport {...props} detail={detail} page={page} setPage={setPage} filter={filter} setFilter={f => { setFilter(f); setPage(1); }} onChanged={load} />;
}

function Heading({ campaign, back = true, actions }: { campaign: EmailCampaignRow; back?: boolean; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        {back && <Link href="/marketing/email" className="inline-flex w-fit items-center gap-1 text-[11px] font-semibold text-ui-nav-active hover:underline"><ArrowLeft size={12} /> Email Campaigns</Link>}
        <h1 className={cn('m-0 flex flex-wrap items-center gap-3 text-[28px] font-semibold leading-[1.35]', HEADING_TEXT)}>
          {campaign.name} <StatusBadge group="email_campaign" status={campaign.status} />
        </h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ── Editor (draft / scheduled) ───────────────────────────────────────────────────────────

function CampaignEditor({ campaign, canEdit, isManager, userId, mailReady, marketingCampaigns, regions, sources, onChanged }: Props & { campaign: EmailCampaignRow; onChanged: () => Promise<void> }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: campaign.name, subject: campaign.subject, preheader: campaign.preheader ?? '', body_html: campaign.body_html,
  });
  const [audience, setAudience] = useState<Audience>(campaign.audience ?? {});
  const [count, setCount] = useState<AudienceCount | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [when, setWhen] = useState(toLocalInput(campaign.scheduled_at));
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const dirty = useRef(false);
  const ro = !canEdit || campaign.status === 'scheduled';

  useEffect(() => { fetch('/api/marketing/mail-templates').then(r => r.json()).then(b => setTemplates(b.templates ?? [])).catch(() => {}); }, []);

  // Live recipient count, a moment after the audience stops changing.
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        setCount(await sendJson<AudienceCount>(`/api/marketing/email-campaigns/${campaign.id}/audience`, 'POST', { audience }));
        setCountError(null);
      } catch (e) {
        setCount(null);
        setCountError(e instanceof Error ? e.message : 'Could not count');
      }
    }, 500);
    return () => clearTimeout(t);
  }, [audience, campaign.id]);

  const setF = (patch: Partial<typeof form>) => { dirty.current = true; setForm(f => ({ ...f, ...patch })); };
  const setA = (patch: Partial<Audience>) => { dirty.current = true; setAudience(a => ({ ...a, ...patch })); };

  async function save(quiet = false): Promise<boolean> {
    try {
      await sendJson(`/api/marketing/email-campaigns/${campaign.id}`, 'PATCH', { ...form, audience });
      dirty.current = false;
      if (!quiet) toast.success('Saved');
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
      return false;
    }
  }

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Something went wrong', { duration: 10_000 }); } finally { setBusy(null); }
  }

  const sendTest = () => run('test', async () => {
    if (!(await save(true))) return;
    const r = await sendJson<{ to: string }>(`/api/marketing/email-campaigns/${campaign.id}/test`, 'POST');
    toast.success(`Test sent to ${r.to}`);
  });
  const schedule = () => run('schedule', async () => {
    if (!when) { toast.error('Pick the date and time to send'); return; }
    if (!(await save(true))) return;
    const r = await sendJson<{ recipients: number }>(`/api/marketing/email-campaigns/${campaign.id}/send`, 'POST', { at: new Date(when).toISOString() });
    toast.success(`Scheduled for ${r.recipients} recipients`);
    await onChanged();
  });
  const sendNow = async () => {
    setBusy('send');
    try {
      if (!(await save(true))) throw new Error('Save failed');
      const r = await sendJson<{ queued: number; sent: number; done: boolean }>(`/api/marketing/email-campaigns/${campaign.id}/send`, 'POST', {});
      toast.success(r.done ? `Sent to ${r.sent} recipients` : `Sending to ${r.queued} recipients — ${r.sent} out so far, the rest follow automatically`);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send', { duration: 10_000 });
      throw e;
    } finally {
      setBusy(null);
    }
  };
  const unschedule = () => run('unschedule', async () => {
    await sendJson(`/api/marketing/email-campaigns/${campaign.id}/control`, 'POST', { action: 'unschedule' });
    toast.success('Back to draft — nothing was sent'); await onChanged();
  });
  const remove = async () => {
    await sendJson(`/api/marketing/email-campaigns/${campaign.id}`, 'DELETE');
    toast.success('Campaign deleted');
    router.push('/marketing/email');
  };

  function insertToken(token: string) {
    const el = bodyRef.current;
    const text = `{{${token}}}`;
    const pos = el?.selectionStart ?? form.body_html.length;
    setF({ body_html: form.body_html.slice(0, pos) + text + form.body_html.slice(pos) });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(pos + text.length, pos + text.length); });
  }

  const preview = useMemo(() => previewHtml(form.body_html || '<p style="color:#9ca3af">The email content shows here.</p>', form.preheader || null), [form.body_html, form.preheader]);
  const canDelete = canEdit && (isManager || campaign.created_by === userId);
  const ready = !!form.subject.trim() && !!form.body_html.trim() && !!count?.recipients && mailReady;

  return (
    <div className="flex flex-col gap-[24px]">
      <Heading
        campaign={campaign}
        actions={canEdit && (
          <>
            {canDelete && <Button variant="ghost" className="text-error-normal" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete</Button>}
            {!ro && <Button variant="secondary" onClick={() => save()}>Save draft</Button>}
          </>
        )}
      />

      {campaign.status === 'scheduled' && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] bg-info-light px-3 py-2.5 text-[12px] text-info-dark">
          <span><CalendarClock className="mr-1 inline size-4 align-text-bottom" /> Scheduled for {campaign.scheduled_at ? WHEN.format(new Date(campaign.scheduled_at)) : '—'} to {fmtNumber(campaign.recipient_count)} recipients. Unschedule it to make changes.</span>
          {canEdit && <Button size="sm" variant="secondary" loading={busy === 'unschedule'} onClick={unschedule}>Unschedule</Button>}
        </div>
      )}
      {campaign.last_error && (
        <div role="alert" className="flex items-start gap-2 rounded-[6px] bg-error-light px-3 py-2.5 text-[12px] text-error-dark"><CircleAlert className="mt-px size-4 shrink-0" /> {campaign.last_error}</div>
      )}
      {!mailReady && canEdit && (
        <div role="note" className="rounded-[6px] bg-warning-light px-3 py-2.5 text-[12px] text-warning-dark">
          Connect your mailbox in <a href="/settings" className="font-semibold underline">Settings → Email sending</a> to send this campaign.
        </div>
      )}

      <fieldset disabled={ro} className="m-0 flex min-w-0 flex-col gap-[24px] border-0 p-0">
        {/* 1 · Details */}
        <section className={cn(PANEL, 'flex flex-col gap-4 p-6')}>
          <h2 className="m-0 text-[15px] font-semibold text-ui-heading">1 · Details</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Campaign name (only the team sees it)" htmlFor="c-name"><Input id="c-name" value={form.name} onChange={e => setF({ name: e.target.value })} /></Field>
            <Field label="Subject line" htmlFor="c-subject" hint="Merge fields work here too, e.g. “{{first_name}}, see you at NACS”.">
              <Input id="c-subject" value={form.subject} onChange={e => setF({ subject: e.target.value })} />
            </Field>
            <Field label="Preview text (optional)" htmlFor="c-pre" hint="The grey line inbox apps show after the subject." className="md:col-span-2">
              <Input id="c-pre" value={form.preheader} onChange={e => setF({ preheader: e.target.value })} />
            </Field>
          </div>
        </section>

        {/* 2 · Audience */}
        <section className={cn(PANEL, 'flex flex-col gap-4 p-6')}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="m-0 text-[15px] font-semibold text-ui-heading">2 · Audience</h2>
              <p className="m-0 text-[12px] text-ui-text-secondary">The Contacts that match every filter below. Unsubscribed and bounced addresses are always left out.</p>
            </div>
            <div className="flex items-center gap-2 rounded-[8px] bg-ui-hover-bg px-3 py-2" aria-live="polite">
              <Users className="size-4 text-ui-text-secondary" />
              {count ? (
                <span className="text-[13px]"><strong className="tabular-nums text-ui-heading">{fmtNumber(count.recipients)}</strong> recipients
                  <span className="text-[11px] text-ui-text-secondary"> · {fmtNumber(count.matched)} Contacts matched{count.noEmail ? `, ${fmtNumber(count.noEmail)} without email` : ''}{count.suppressed ? `, ${fmtNumber(count.suppressed)} unsubscribed` : ''}</span>
                </span>
              ) : <span className="text-[12px] text-ui-text-secondary">{countError ?? 'Counting…'}</span>}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Campaign / event">
              <Select aria-label="Campaign or event" value={audience.campaignId ?? ''} options={[{ value: '', label: 'Any' }, ...marketingCampaigns]} onValueChange={v => setA({ campaignId: v || undefined })} disabled={ro} />
            </Field>
            <Field label="Region">
              <Select aria-label="Region" value={audience.region ?? ''} options={[{ value: '', label: 'Any region' }, ...regions]} onValueChange={v => setA({ region: v || undefined })} disabled={ro} />
            </Field>
            <Field label="Source">
              <Select aria-label="Source" value={audience.sources?.[0] ?? ''} options={[{ value: '', label: 'Any source' }, ...sources.map(s => ({ value: s, label: s }))]} onValueChange={v => setA({ sources: v ? [v] : undefined })} disabled={ro} />
            </Field>
            <Field label="Classification">
              <Select aria-label="Classification" value={audience.status ?? ''} options={STATUS_OPTIONS} onValueChange={v => setA({ status: v || undefined })} disabled={ro} />
            </Field>
            <Field label="Projects">
              <Select aria-label="Projects" value={audience.projectStatus ?? ''} options={PROJECT_OPTIONS} onValueChange={v => setA({ projectStatus: v || undefined })} disabled={ro} />
            </Field>
            <Field label="Name contains" htmlFor="c-q"><Input id="c-q" value={audience.q ?? ''} onChange={e => setA({ q: e.target.value || undefined })} /></Field>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-ui-body">
            {([['surveyOnly', 'Came from a survey'], ['followUpOverdue', 'Follow-up overdue'], ['includePeople', 'Also email the people saved inside each Contact']] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-[var(--color-secondary-700)]" checked={!!audience[k]} onChange={e => setA({ [k]: e.target.checked || undefined })} /> {l}
              </label>
            ))}
          </div>
          {count?.sample.length ? <p className="m-0 text-[11px] text-ui-text-secondary">For example: {count.sample.join(', ')}{count.recipients > count.sample.length ? '…' : ''}</p> : null}
        </section>

        {/* 3 · Content */}
        <section className={cn(PANEL, 'flex flex-col gap-4 p-6')}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="m-0 text-[15px] font-semibold text-ui-heading">3 · Content</h2>
              <p className="m-0 text-[12px] text-ui-text-secondary">HTML or plain text. The unsubscribe link and the company address are added at the bottom automatically.</p>
            </div>
            <Select className="w-[240px]" aria-label="Start from a template" value="" placeholder={templates.length ? 'Start from a template…' : 'No templates yet'}
              options={templates.map(t => ({ value: t.id, label: t.name }))} disabled={ro || !templates.length}
              onValueChange={v => { const t = templates.find(x => x.id === v); if (t) setF({ body_html: t.body_html, subject: form.subject || t.subject }); }} />
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Textarea ref={bodyRef} rows={22} className="font-mono text-[12px]" value={form.body_html} onChange={e => setF({ body_html: e.target.value })}
                placeholder={'<h1>Hi {{first_name}},</h1>\n<p>Thanks for visiting our booth…</p>\n<p><a href="https://tlines.us">See our latest stores</a></p>'} aria-label="Email content" />
              <div className="flex flex-wrap gap-1.5">
                {MERGE_FIELDS.map(f => (
                  <button key={f.token} type="button" onClick={() => insertToken(f.token)} title={f.label} disabled={ro}
                    className="cursor-pointer rounded-tag border border-ui-divider bg-transparent px-2 py-0.5 font-mono text-[11px] text-ui-body hover:bg-ui-hover-bg disabled:cursor-default">
                    {`{{${f.token}}}`}
                  </button>
                ))}
              </div>
            </div>
            {/* Sandboxed preview: the HTML is shown, never run. */}
            <iframe title="Email preview" sandbox="allow-popups" srcDoc={preview} className="h-[520px] w-full rounded-[8px] border border-ui-divider bg-white" />
          </div>
        </section>
      </fieldset>

      {/* 4 · Send */}
      {canEdit && campaign.status !== 'scheduled' && (
        <section className={cn(PANEL, 'flex flex-col gap-4 p-6')}>
          <h2 className="m-0 text-[15px] font-semibold text-ui-heading">4 · Test and send</h2>
          <div className="flex flex-wrap items-end gap-3">
            <Button variant="secondary" loading={busy === 'test'} disabled={!!busy || !mailReady} onClick={sendTest}><FlaskConical /> Send a test to me</Button>
            <span className="mx-2 hidden h-8 w-px bg-ui-divider sm:block" aria-hidden />
            <Field label="Send later" htmlFor="c-when">
              <Input id="c-when" type="datetime-local" className="w-[230px]" value={when} onChange={e => setWhen(e.target.value)} />
            </Field>
            <Button variant="secondary" loading={busy === 'schedule'} disabled={!!busy || !ready} onClick={schedule}><CalendarClock /> Schedule</Button>
            <Button className="ml-auto" disabled={!!busy || !ready} onClick={() => setConfirmSend(true)}><Send /> Send now</Button>
          </div>
          <p className="m-0 text-[11px] text-ui-text-secondary">
            Emails go out from your mailbox in batches of about 40 every 10 minutes, up to your daily limit (Settings → Email sending); a large audience continues the next day.
          </p>
        </section>
      )}

      <ConfirmModal
        open={confirmSend} onOpenChange={setConfirmSend}
        title={`Send to ${fmtNumber(count?.recipients ?? 0)} recipients now?`}
        description={form.subject}
        confirmLabel="Send now"
        warning="Emails can’t be recalled once they’re sent."
        onConfirm={sendNow}
      />
      <ConfirmModal
        open={confirmDelete} onOpenChange={setConfirmDelete}
        title="Delete this campaign?" description={campaign.name} tone="destructive" confirmLabel="Delete campaign" onConfirm={remove}
      />
    </div>
  );
}

// ── Report (sending / paused / sent / cancelled) ─────────────────────────────────────────

function CampaignReport({ detail, canEdit, page, setPage, filter, setFilter, onChanged }: Props & {
  detail: Detail; page: number; setPage: (p: number) => void; filter: string; setFilter: (f: string) => void; onChanged: () => Promise<void>;
}) {
  const { campaign: c, stats: s, recipients, recipientTotal, topLinks, sender } = detail;
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  async function control(action: string) {
    setBusy(action);
    try {
      await sendJson(`/api/marketing/email-campaigns/${c.id}/control`, 'POST', { action });
      toast.success(action === 'pause' ? 'Paused — nothing more goes out until you resume' : action === 'resume' ? 'Resumed' : 'Cancelled');
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update');
      throw e;
    } finally {
      setBusy(null);
    }
  }

  const sent = Number(s.sent);
  const progress = s.total ? Math.round(((s.total - s.pending) / s.total) * 100) : 0;
  const pages = Math.max(1, Math.ceil(recipientTotal / 50));

  return (
    <div className="flex flex-col gap-[24px]">
      <Heading
        campaign={c}
        actions={canEdit && (
          <>
            {c.status === 'sending' && <Button variant="secondary" loading={busy === 'pause'} onClick={() => control('pause')}><Pause /> Pause</Button>}
            {c.status === 'paused' && <Button loading={busy === 'resume'} onClick={() => control('resume')}><Play /> Resume</Button>}
            {(c.status === 'sending' || c.status === 'paused') && <Button variant="ghost" className="text-error-normal" onClick={() => setConfirmCancel(true)}><X /> Cancel</Button>}
          </>
        )}
      />
      <p className="-mt-3 m-0 text-[13px] text-ui-body">
        “{c.subject}” · from {sender?.full_name || sender?.email || '—'}
        {mounted && c.started_at ? ` · started ${WHEN.format(new Date(c.started_at))}` : ''}
        {mounted && c.finished_at ? ` · finished ${WHEN.format(new Date(c.finished_at))}` : ''}
      </p>

      {c.last_error && (
        <div role="alert" className="flex items-start gap-2 rounded-[6px] bg-warning-light px-3 py-2.5 text-[12px] text-warning-dark"><CircleAlert className="mt-px size-4 shrink-0" /> {c.last_error}</div>
      )}
      {(c.status === 'sending' || c.status === 'paused') && (
        <div className={cn(PANEL, 'flex flex-col gap-2 p-4')}>
          <div className="flex justify-between text-[12px]"><span>{fmtNumber(s.total - s.pending)} of {fmtNumber(s.total)} processed</span><span className="tabular-nums">{progress}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-ui-hover-bg" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-[var(--color-secondary-700)] transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={<Send />} label="Delivered" value={fmtNumber(sent)} badge={s.failed ? { label: `${s.failed} failed`, tone: 'error' } : undefined} />
        <KpiCard icon={<Eye />} label="Opened" value={rateText(pct(Number(s.opened), sent))} badge={{ label: `${fmtNumber(Number(s.opened))} people`, tone: 'neutral' }} />
        <KpiCard icon={<MousePointerClick />} label="Clicked" value={rateText(pct(Number(s.clicked), sent))} badge={{ label: `${fmtNumber(Number(s.clicked))} people`, tone: 'neutral' }} />
        <KpiCard icon={<Ban />} label="Unsubscribed" value={fmtNumber(Number(s.unsubscribed))} badge={sent ? { label: rateText(pct(Number(s.unsubscribed), sent)), tone: Number(s.unsubscribed) ? 'warning' : 'neutral' } : undefined} />
      </div>
      <p className="-mt-2 m-0 text-[11px] text-ui-text-secondary">Opens are an estimate: some mail apps block the tracking image, others (Apple Mail) open every email automatically. Clicks are exact.</p>

      {topLinks.length > 0 && (
        <section className={cn(PANEL, 'p-6')}>
          <h2 className="m-0 mb-3 text-[15px] font-semibold text-ui-heading">Links clicked</h2>
          <table className="w-full border-collapse">
            <thead><tr className="border-b border-ui-divider"><th className={TH_CLS}>Link</th><th className={cn(TH_CLS, 'text-right')}>People</th><th className={cn(TH_CLS, 'text-right')}>Clicks</th></tr></thead>
            <tbody>{topLinks.map(l => (
              <tr key={l.url} className="border-b border-ui-divider last:border-b-0">
                <td className={TD_CLS}><a href={l.url} target="_blank" rel="noreferrer" className="block max-w-[560px] truncate text-ui-link hover:underline">{l.url}</a></td>
                <td className={cn(TD_CLS, 'text-right tabular-nums')}>{fmtNumber(l.people)}</td>
                <td className={cn(TD_CLS, 'text-right tabular-nums')}>{fmtNumber(l.clicks)}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      )}

      <section className={cn(PANEL, 'flex flex-col gap-4 p-6')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-[15px] font-semibold text-ui-heading">Recipients <span className="text-[12px] font-normal text-ui-text-secondary">({fmtNumber(recipientTotal)})</span></h2>
          <Select className="w-[180px]" aria-label="Show" value={filter} options={RECIPIENT_FILTERS} onValueChange={v => setFilter(v ?? '')} />
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
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="tabular-nums">Page {page} of {pages}</span>
            <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </section>

      <section className={cn(PANEL, 'flex flex-col gap-3 p-6')}>
        <h2 className="m-0 text-[15px] font-semibold text-ui-heading">Content that was sent</h2>
        <iframe title="Sent email" sandbox="allow-popups" srcDoc={previewHtml(c.body_html, c.preheader)} className="h-[480px] w-full rounded-[8px] border border-ui-divider bg-white" />
      </section>

      <ConfirmModal
        open={confirmCancel} onOpenChange={setConfirmCancel}
        title="Cancel this campaign?" description={`${fmtNumber(s.pending)} emails not sent yet will be dropped. What already went out stays in this report.`}
        tone="destructive" confirmLabel="Cancel campaign" onConfirm={() => control('cancel')}
      />
    </div>
  );
}
