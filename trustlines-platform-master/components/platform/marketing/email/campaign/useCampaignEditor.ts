'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { sendJson } from '@/components/platform/marketing/pr/shared';
import type { EmailCampaignRow } from '@/lib/email/campaigns';
import type { Audience } from '@/lib/email/sender';
import { toLocalInput, type AudienceCount, type CampaignForm, type Template } from './campaignData';

/** Form + audience state, the live recipient count, templates, and every editor action. */
export function useCampaignEditor(campaign: EmailCampaignRow, onChanged: () => Promise<void>) {
  const router = useRouter();
  const [form, setForm] = useState<CampaignForm>({
    name: campaign.name, subject: campaign.subject, preheader: campaign.preheader ?? '', body_html: campaign.body_html,
  });
  const [audience, setAudience] = useState<Audience>(campaign.audience ?? {});
  const [count, setCount] = useState<AudienceCount | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [when, setWhen] = useState(toLocalInput(campaign.scheduled_at));
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const dirty = useRef(false);

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

  const setF = (patch: Partial<CampaignForm>) => { dirty.current = true; setForm(f => ({ ...f, ...patch })); };
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
  /** Throws on failure so the confirm modal stays open. */
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

  return {
    form, setF, audience, setA, count, countError, templates, busy, when, setWhen, bodyRef,
    save, sendTest, schedule, sendNow, unschedule, remove, insertToken,
  };
}
