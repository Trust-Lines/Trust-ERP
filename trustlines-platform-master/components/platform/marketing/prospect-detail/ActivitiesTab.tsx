'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CircleAlert, Eye, Mail, MousePointerClick, Send } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { MERGE_FIELDS } from '@/lib/marketing/mailTemplates';
import type { Contact, Prospect } from './types';

// Contact → Activities: every email this Contact received from the ERP (one-to-one and
// campaigns, with opens and clicks) and "Send email" from the user's own mailbox.

interface EmailRow {
  id: string; kind: 'direct' | 'campaign'; campaign_id: string | null; sender_user_id: string | null; to_email: string; to_name: string | null;
  subject: string; body_html: string | null; status: string; error: string | null; sent_at: string | null;
  opened_at: string | null; open_count: number; clicked_at: string | null; click_count: number; unsubscribed_at: string | null; created_at: string;
}
interface Template { id: string; name: string; subject: string; body_html: string }

const WHEN = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export function ActivitiesTab({ prospect, contacts, canEdit }: { prospect: Prospect; contacts: Contact[]; canEdit?: boolean }) {
  const [emails, setEmails] = useState<EmailRow[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [campaignNames, setCampaignNames] = useState<Record<string, string>>({});
  const [suppression, setSuppression] = useState<{ reason: string; created_at: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [viewing, setViewing] = useState<EmailRow | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const load = useCallback(async () => {
    const res = await fetch(`/api/marketing/prospects/${prospect.id}/emails`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body.error ?? 'Could not load the emails'); setEmails([]); return; }
    setError(null);
    setEmails(body.emails);
    setNames(Object.fromEntries((body.senders ?? []).map((s: { id: string; full_name: string | null; email: string }) => [s.id, s.full_name || s.email])));
    setCampaignNames(Object.fromEntries((body.campaigns ?? []).map((c: { id: string; name: string }) => [c.id, c.name])));
    setSuppression(body.suppression);
  }, [prospect.id]);
  useEffect(() => { load(); }, [load]);

  // Every address on the Contact: its main email and each person's.
  const recipients = useMemo(() => {
    const list: { value: string; label: string; name: string | null }[] = [];
    const seen = new Set<string>();
    const add = (email: string | null, name: string | null, label: string) => {
      const e = email?.trim().toLowerCase();
      if (!e || seen.has(e)) return;
      seen.add(e);
      list.push({ value: e, label, name });
    };
    add(prospect.main_email, null, `${prospect.display_name} — ${prospect.main_email}`);
    for (const c of contacts) add(c.email, c.name, `${c.name}${c.title ? ` (${c.title})` : ''} — ${c.email}`);
    return list;
  }, [prospect, contacts]);

  return (
    <div className="card"><div className="card-body" style={{ padding: 20 }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="m-0 text-[15px] font-semibold">Emails</h3>
          <p className="m-0 text-[12px] text-ui-text-secondary">Sent from the ERP — one-to-one and campaigns — with opens and clicks.</p>
        </div>
        {canEdit && (
          <Button onClick={() => setComposing(true)} disabled={!recipients.length} title={recipients.length ? undefined : 'Add an email address to this Contact first'}>
            <Send /> Send email
          </Button>
        )}
      </div>

      {suppression && (
        <div role="note" className="mb-4 flex items-start gap-2 rounded-[6px] bg-warning-light px-3 py-2 text-[12px] text-warning-dark">
          <CircleAlert className="mt-px size-4 shrink-0" aria-hidden />
          The main address {suppression.reason === 'unsubscribed' ? 'unsubscribed' : `is on the do-not-email list (${suppression.reason})`} — the ERP won’t email it.
        </div>
      )}

      {emails === null ? (
        <p className="m-0 text-[13px] text-ui-text-secondary">Loading…</p>
      ) : error ? (
        <p className="m-0 text-[13px] text-ui-text-secondary">{error}</p>
      ) : emails.length === 0 ? (
        <EmptyState icon={<Mail />} title="No emails yet" description={canEdit ? 'Emails you send from here — and campaigns this Contact receives — will show up in this list.' : undefined} />
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-ui-divider p-0">
          {emails.map(e => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => setViewing(e)} disabled={!e.body_html && e.kind !== 'campaign'}
                  className="block max-w-full cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[13px] font-semibold text-ui-heading hover:underline disabled:cursor-default disabled:no-underline">
                  {e.subject}
                </button>
                <div className="text-[12px] text-ui-text-secondary">
                  {e.kind === 'campaign' ? (
                    <>Campaign · <Link href={`/marketing/email/${e.campaign_id}`} className="text-ui-link hover:underline">{campaignNames[e.campaign_id ?? ''] ?? 'Email campaign'}</Link></>
                  ) : 'One-to-one'}
                  {' · to '}{e.to_name ? `${e.to_name} <${e.to_email}>` : e.to_email}
                  {e.sender_user_id && names[e.sender_user_id] ? ` · from ${names[e.sender_user_id]}` : ''}
                  {mounted && (e.sent_at || e.created_at) ? ` · ${WHEN.format(new Date(e.sent_at ?? e.created_at))}` : ''}
                </div>
                {e.status === 'failed' && e.error && <div className="text-[11px] text-error-dark">{e.error}</div>}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-ui-text-secondary">
                {e.opened_at && <span className="inline-flex items-center gap-1" title={`Opened ${e.open_count}×`}><Eye size={13} /> {e.open_count}</span>}
                {e.clicked_at && <span className="inline-flex items-center gap-1" title={`Clicked ${e.click_count}×`}><MousePointerClick size={13} /> {e.click_count}</span>}
                {e.unsubscribed_at && <span className="rounded-tag bg-warning-light px-1.5 text-warning-dark">Unsubscribed</span>}
                <StatusBadge group="email_message" status={e.status} size="sm" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {composing && (
        <ComposeDialog
          prospectId={prospect.id} recipients={recipients}
          onClose={() => setComposing(false)} onSent={() => { setComposing(false); load(); }}
        />
      )}

      <Modal open={!!viewing} onOpenChange={o => { if (!o) setViewing(null); }}>
        {viewing && (
          <ModalContent size="lg" title={viewing.subject} description={`To ${viewing.to_email}`}>
            {viewing.body_html ? (
              // Sandboxed: no scripts, no same-origin access — the HTML is shown, never run.
              <iframe title="Email" sandbox="" srcDoc={viewing.body_html} className="h-[420px] w-full rounded-[6px] border border-ui-divider bg-white" />
            ) : (
              <p className="m-0 text-[13px]">This was a campaign email — <Link href={`/marketing/email/${viewing.campaign_id}`} className="text-ui-link hover:underline">open the campaign</Link> to see its content.</p>
            )}
          </ModalContent>
        )}
      </Modal>
    </div></div>
  );
}

function ComposeDialog({ prospectId, recipients, onClose, onSent }: {
  prospectId: string; recipients: { value: string; label: string; name: string | null }[]; onClose: () => void; onSent: () => void;
}) {
  const [to, setTo] = useState(recipients[0]?.value ?? '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [signature, setSignature] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sending, setSending] = useState(false);
  const [mailReady, setMailReady] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/marketing/mail-templates').then(r => r.json()).then(b => setTemplates(b.templates ?? [])).catch(() => {});
    fetch('/api/me/mail-settings').then(r => r.json()).then(b => setMailReady(!!b.settings)).catch(() => setMailReady(false));
  }, []);

  function applyTemplate(id: string | null) {
    const t = templates.find(x => x.id === id);
    if (!t) return;
    setSubject(t.subject);
    setBody(t.body_html);
  }

  async function send() {
    if (!to || !subject.trim() || !body.trim()) { toast.error('Pick a recipient and write a subject and a message'); return; }
    setSending(true);
    try {
      const r = recipients.find(x => x.value === to);
      const res = await fetch(`/api/marketing/prospects/${prospectId}/emails`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, toName: r?.name, subject, body, includeSignature: signature }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not send', { duration: 10_000 }); return; }
      toast.success(`Sent to ${to}`);
      onSent();
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open onOpenChange={o => { if (!o) onClose(); }}>
      <ModalContent
        size="lg" title="Send email" description="Goes out from your own mailbox; replies come back to you."
        footer={(
          <>
            <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
            <Button loading={sending} disabled={mailReady === false} onClick={send}><Send /> Send</Button>
          </>
        )}
      >
        <div className="flex flex-col gap-4">
          {mailReady === false && (
            <div role="alert" className="flex flex-wrap items-center gap-2 rounded-[6px] bg-warning-light px-3 py-2 text-[12px] text-warning-dark">
              <CircleAlert className="size-4 shrink-0" aria-hidden /> Connect your mailbox first.
              <Link href="/settings" className={buttonVariants({ variant: 'secondary', size: 'xs' })}>Open Settings</Link>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1"><span className="text-[12px] font-medium text-ui-body">To</span>
              <Select aria-label="To" value={to} options={recipients} onValueChange={v => setTo(v ?? '')} />
            </label>
            <label className="flex flex-col gap-1"><span className="text-[12px] font-medium text-ui-body">Start from a template</span>
              <Select aria-label="Template" value="" placeholder={templates.length ? 'Pick a template…' : 'No templates yet'}
                options={templates.map(t => ({ value: t.id, label: t.name }))} onValueChange={applyTemplate} disabled={!templates.length} />
            </label>
          </div>
          <label className="flex flex-col gap-1"><span className="text-[12px] font-medium text-ui-body">Subject</span>
            <Input value={subject} onChange={e => setSubject(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1"><span className="text-[12px] font-medium text-ui-body">Message</span>
            <Textarea rows={10} value={body} onChange={e => setBody(e.target.value)} placeholder="Write as you would in your mail app. Blank lines start a new paragraph." />
            <span className="text-[11px] text-ui-text-secondary">
              Merge fields: {MERGE_FIELDS.map(f => `{{${f.token}}}`).join(' ')}
            </span>
          </label>
          <label className="flex items-center gap-2 text-[12px] text-ui-body">
            <input type="checkbox" className="size-4 accent-[var(--color-secondary-700)]" checked={signature} onChange={e => setSignature(e.target.checked)} />
            Add my signature
          </label>
        </div>
      </ModalContent>
    </Modal>
  );
}
