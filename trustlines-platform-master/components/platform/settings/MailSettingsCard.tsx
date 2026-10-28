'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CircleAlert, CircleCheck, Mail, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { ConfirmModal } from '@/components/ui/modal';
import { SMTP_PRESETS } from '@/lib/email/presets';

// Settings → Email sending: each person connects their own mailbox, so emails to Contacts and
// the campaigns they launch come from them (and replies land in their inbox).

interface Saved {
  from_name: string; from_email: string; reply_to: string | null; smtp_host: string; smtp_port: number; smtp_secure: boolean;
  smtp_user: string; signature_html: string | null; daily_limit: number; verified_at: string | null; last_error: string | null;
}
type Form = { preset: string; from_name: string; from_email: string; reply_to: string; smtp_host: string; smtp_port: string; smtp_secure: boolean; smtp_user: string; smtp_pass: string; signature_html: string; daily_limit: string };

const presetOf = (host: string) => SMTP_PRESETS.find(p => p.host && p.host === host)?.value ?? 'custom';
const toForm = (s: Saved | null, email: string): Form => s
  ? {
    preset: presetOf(s.smtp_host), from_name: s.from_name, from_email: s.from_email, reply_to: s.reply_to ?? '', smtp_host: s.smtp_host,
    smtp_port: String(s.smtp_port), smtp_secure: s.smtp_secure, smtp_user: s.smtp_user, smtp_pass: '', signature_html: s.signature_html ?? '', daily_limit: String(s.daily_limit),
  }
  : {
    preset: 'google', from_name: '', from_email: email, reply_to: '', smtp_host: 'smtp.gmail.com', smtp_port: '465', smtp_secure: true,
    smtp_user: email, smtp_pass: '', signature_html: '', daily_limit: '400',
  };

const label = 'text-[12px] font-medium text-ui-body';
const SECURITY = [{ value: 'tls', label: 'SSL/TLS (usually port 465)' }, { value: 'starttls', label: 'STARTTLS (usually port 587)' }];

export function MailSettingsCard({ email }: { email: string }) {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [form, setForm] = useState<Form>(toForm(null, email));
  const [notReady, setNotReady] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);

  useEffect(() => {
    fetch('/api/me/mail-settings').then(async res => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setNotReady(body.error ?? 'Email settings are unavailable'); return; }
      if (!body.encryptionReady) setNotReady('This server has no valid APP_ENCRYPTION_KEY (missing, or not the 44-character key — no quotes or spaces), so passwords can’t be saved or read here. An admin must set it in Vercel for this environment (Production and Preview) and redeploy.');
      setSaved(body.settings);
      setForm(toForm(body.settings, email));
    }).catch(() => setNotReady('Email settings are unavailable')).finally(() => setLoading(false));
  }, [email]);

  const set = (patch: Partial<Form>) => setForm(f => ({ ...f, ...patch }));
  const preset = SMTP_PRESETS.find(p => p.value === form.preset) ?? SMTP_PRESETS[2];

  function pickPreset(value: string) {
    const p = SMTP_PRESETS.find(x => x.value === value);
    if (!p) return;
    set({ preset: p.value, ...(p.host ? { smtp_host: p.host, smtp_port: String(p.port), smtp_secure: p.secure, daily_limit: String(p.dailyLimit) } : {}) });
  }

  async function save(): Promise<boolean> {
    setBusy('save');
    try {
      const res = await fetch('/api/me/mail-settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, smtp_port: Number(form.smtp_port), daily_limit: Number(form.daily_limit) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? 'Could not save'); return false; }
      setSaved(body.settings);
      set({ smtp_pass: '' });
      return true;
    } finally {
      setBusy(null);
    }
  }

  async function saveAndTest() {
    if (!(await save())) return;
    setBusy('test');
    try {
      const res = await fetch('/api/me/mail-settings/test', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? 'The test failed', { duration: 12_000 });
        setSaved(s => (s ? { ...s, last_error: body.error ?? 'The test failed', verified_at: null } : s));
        return;
      }
      toast.success(`Connected — a test email was sent to ${body.to}`);
      setSaved(s => (s ? { ...s, verified_at: new Date().toISOString(), last_error: null } : s));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    const res = await fetch('/api/me/mail-settings', { method: 'DELETE' });
    if (!res.ok) { toast.error('Could not remove'); throw new Error('remove failed'); }
    setSaved(null);
    setForm(toForm(null, email));
    toast.success('Email account removed');
  }

  return (
    <div className="card">
      <div className="card-body" style={{ padding: 20 }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 flex items-center gap-2 text-[16px] font-bold"><Mail size={18} /> Email sending</h2>
            <p className="m-0 mt-1 max-w-[720px] text-[13px] text-ui-text-secondary">
              Connect your own mailbox. Emails you send to Contacts and the email campaigns you launch go out from this address, and replies come back to your inbox.
            </p>
          </div>
          {saved && (saved.verified_at
            ? <span className="inline-flex items-center gap-1.5 rounded-tag bg-success-light px-2.5 py-1 text-[12px] font-medium text-success-dark"><CircleCheck size={14} /> Connected</span>
            : <span className="inline-flex items-center gap-1.5 rounded-tag bg-warning-light px-2.5 py-1 text-[12px] font-medium text-warning-dark"><CircleAlert size={14} /> Not tested yet</span>)}
        </div>

        {loading ? (
          <p className="mt-4 text-[13px] text-ui-text-secondary">Loading…</p>
        ) : notReady && !saved ? (
          <p className="mt-4 text-[13px] text-ui-text-secondary">{notReady}</p>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            {/* The buttons below are disabled while this is set — always say why. */}
            {notReady && (
              <div role="alert" className="flex items-start gap-2 rounded-[6px] bg-warning-light px-3 py-2 text-[12px] text-warning-dark">
                <CircleAlert className="mt-px size-4 shrink-0" aria-hidden /> <span>{notReady}</span>
              </div>
            )}
            {saved?.last_error && (
              <div role="alert" className="flex items-start gap-2 rounded-[6px] bg-error-light px-3 py-2 text-[12px] text-error-dark">
                <CircleAlert className="mt-px size-4 shrink-0" aria-hidden /> <span>{saved.last_error}</span>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <span className={label}>Email provider</span>
                <Select aria-label="Email provider" value={form.preset} options={SMTP_PRESETS.map(p => ({ value: p.value, label: p.label }))} onValueChange={v => pickPreset(v ?? 'custom')} />
              </div>
              <label className="flex flex-col gap-1"><span className={label}>Your name (shown as sender)</span>
                <Input value={form.from_name} placeholder="e.g. Jordan Smith — Trust-Lines" onChange={e => set({ from_name: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1"><span className={label}>From address</span>
                <Input type="email" value={form.from_email} onChange={e => set({ from_email: e.target.value, ...(form.smtp_user === form.from_email ? { smtp_user: e.target.value } : {}) })} />
              </label>
            </div>
            <p className="m-0 rounded-[6px] bg-info-light px-3 py-2 text-[12px] text-info-dark">{preset.help}</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <label className="flex flex-col gap-1 md:col-span-2"><span className={label}>SMTP server</span>
                <Input value={form.smtp_host} placeholder="smtp.example.com" onChange={e => set({ smtp_host: e.target.value, preset: 'custom' })} />
              </label>
              <label className="flex flex-col gap-1"><span className={label}>Port</span>
                <Input type="number" inputMode="numeric" value={form.smtp_port} onChange={e => set({ smtp_port: e.target.value })} />
              </label>
              <div className="flex flex-col gap-1"><span className={label}>Security</span>
                <Select aria-label="Security" value={form.smtp_secure ? 'tls' : 'starttls'} options={SECURITY} onValueChange={v => set({ smtp_secure: v === 'tls' })} />
              </div>
              <label className="flex flex-col gap-1 md:col-span-2"><span className={label}>Username</span>
                <Input value={form.smtp_user} autoComplete="off" onChange={e => set({ smtp_user: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 md:col-span-2"><span className={label}>{saved ? 'Password (leave empty to keep the saved one)' : 'Password / app password'}</span>
                <Input type="password" autoComplete="new-password" value={form.smtp_pass} placeholder={saved ? '•••••••• saved' : ''} onChange={e => set({ smtp_pass: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 md:col-span-2"><span className={label}>Reply-to (optional)</span>
                <Input type="email" value={form.reply_to} placeholder="Leave empty to get replies at the from address" onChange={e => set({ reply_to: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 md:col-span-2"><span className={label}>Daily sending limit</span>
                <Input type="number" inputMode="numeric" value={form.daily_limit} onChange={e => set({ daily_limit: e.target.value })} />
                <span className="text-[11px] text-ui-text-secondary">Campaigns pause at this number and continue the next day — keeps your mailbox under the provider’s limits.</span>
              </label>
            </div>
            <label className="flex flex-col gap-1"><span className={label}>Signature (added to emails you send to Contacts)</span>
              <Textarea rows={4} value={form.signature_html} placeholder={'Jordan Smith\nMarketing Manager · Trust-Lines\n+1 555 0100'} onChange={e => set({ signature_html: e.target.value })} />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button loading={busy === 'test'} disabled={!!busy || !!notReady} onClick={saveAndTest}><Send /> Save &amp; send test email</Button>
              <Button variant="secondary" loading={busy === 'save'} disabled={!!busy || !!notReady} onClick={async () => { if (await save()) toast.success('Saved — send a test email to check it works'); }}>Save</Button>
              {saved && (
                <ConfirmModal
                  trigger={<Button variant="ghost" className="ml-auto text-error-normal"><Trash2 /> Remove</Button>}
                  title="Remove your email account?" description="Your saved password is deleted. Campaigns you’re sending will pause until you connect again."
                  tone="destructive" confirmLabel="Remove" onConfirm={remove}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
