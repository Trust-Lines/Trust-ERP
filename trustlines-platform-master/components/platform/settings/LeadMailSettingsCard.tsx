'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CircleAlert, CircleCheck, Inbox, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { SMTP_PRESETS } from '@/lib/email/presets';

// Settings → Website leads: who every website submission (contact form + newsletter) is emailed
// to, and which mailbox sends it. Marketing managers / GM / ops only (MARKETING_MANAGE_ROLES).

interface Saved {
  recipients: string[]; from_name: string | null; from_email: string | null; smtp_host: string | null; smtp_port: number | null;
  smtp_secure: boolean; smtp_user: string | null; verified_at: string | null; last_error: string | null;
}
type Form = {
  recipients: string; use_sender: boolean; preset: string; from_name: string; from_email: string;
  smtp_host: string; smtp_port: string; smtp_secure: boolean; smtp_user: string; smtp_pass: string;
};

const presetOf = (host: string | null) => SMTP_PRESETS.find(p => p.host && p.host === host)?.value ?? 'custom';
const toForm = (s: Saved | null, fallback: string[]): Form => s?.smtp_host
  ? {
    recipients: s.recipients.join('\n'), use_sender: true, preset: presetOf(s.smtp_host), from_name: s.from_name ?? 'Trust-Lines', from_email: s.from_email ?? '',
    smtp_host: s.smtp_host, smtp_port: String(s.smtp_port ?? 465), smtp_secure: s.smtp_secure, smtp_user: s.smtp_user ?? '', smtp_pass: '',
  }
  : {
    recipients: (s?.recipients?.length ? s.recipients : fallback).join('\n'), use_sender: false, preset: 'purelymail', from_name: 'Trust-Lines',
    from_email: 'info@t-lines.us', smtp_host: 'smtp.purelymail.com', smtp_port: '465', smtp_secure: true, smtp_user: 'info@t-lines.us', smtp_pass: '',
  };

const label = 'text-[12px] font-medium text-ui-body';
const SECURITY = [{ value: 'tls', label: 'SSL/TLS (usually port 465)' }, { value: 'starttls', label: 'STARTTLS (usually port 587)' }];
const SENDER = [{ value: 'own', label: 'This mailbox (below)' }, { value: 'default', label: 'The platform’s default account' }];

export function LeadMailSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [hasPassword, setHasPassword] = useState(false);
  const [fallback, setFallback] = useState<string[]>([]);
  const [form, setForm] = useState<Form>(toForm(null, []));
  const [notReady, setNotReady] = useState<string | null>(null);
  const [noKey, setNoKey] = useState(false);
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);

  useEffect(() => {
    fetch('/api/web-cms/lead-mail-settings', { cache: 'no-store' }).then(async res => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setNotReady(body.error ?? 'These settings are unavailable'); return; }
      setNoKey(!body.encryptionReady);
      setSaved(body.settings);
      setHasPassword(!!body.hasPassword);
      setFallback(body.fallbackRecipients ?? []);
      setForm(toForm(body.settings, body.fallbackRecipients ?? []));
    }).catch(() => setNotReady('These settings are unavailable')).finally(() => setLoading(false));
  }, []);

  const set = (patch: Partial<Form>) => setForm(f => ({ ...f, ...patch }));
  const preset = SMTP_PRESETS.find(p => p.value === form.preset) ?? SMTP_PRESETS[SMTP_PRESETS.length - 1];

  function pickPreset(value: string) {
    const p = SMTP_PRESETS.find(x => x.value === value);
    if (p) set({ preset: p.value, ...(p.host ? { smtp_host: p.host, smtp_port: String(p.port), smtp_secure: p.secure } : {}) });
  }

  async function save(): Promise<boolean> {
    setBusy('save');
    try {
      const res = await fetch('/api/web-cms/lead-mail-settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, recipients: form.recipients, smtp_port: Number(form.smtp_port) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? 'Could not save'); return false; }
      setSaved(body.settings);
      setHasPassword(!!body.hasPassword);
      set({ smtp_pass: '' });
      return true;
    } finally { setBusy(null); }
  }

  async function saveAndTest() {
    if (!(await save())) return;
    setBusy('test');
    try {
      const res = await fetch('/api/web-cms/lead-mail-settings/test', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? 'The test failed', { duration: 12_000 });
        setSaved(s => (s ? { ...s, last_error: body.error ?? 'The test failed', verified_at: null } : s));
        return;
      }
      toast.success(`Test email sent to ${(body.to as string[]).join(', ')}`);
      setSaved(s => (s ? { ...s, verified_at: new Date().toISOString(), last_error: null } : s));
    } finally { setBusy(null); }
  }

  const needsKey = noKey && form.use_sender && !!form.smtp_pass;

  return (
    <div className="card">
      <div className="card-body" style={{ padding: 20 }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="m-0 flex items-center gap-2 text-[16px] font-bold"><Inbox size={18} /> Website lead emails</h2>
            <p className="m-0 mt-1 max-w-[720px] text-[13px] text-ui-text-secondary">
              Every submission from the website contact form and newsletter box is emailed, formatted, to these addresses the moment it arrives. “Reply” in the email answers the visitor directly.
            </p>
          </div>
          {saved && (saved.verified_at
            ? <span className="inline-flex items-center gap-1.5 rounded-tag bg-success-light px-2.5 py-1 text-[12px] font-medium text-success-dark"><CircleCheck size={14} /> Working</span>
            : <span className="inline-flex items-center gap-1.5 rounded-tag bg-warning-light px-2.5 py-1 text-[12px] font-medium text-warning-dark"><CircleAlert size={14} /> Not tested yet</span>)}
        </div>

        {loading ? (
          <p className="mt-4 text-[13px] text-ui-text-secondary">Loading…</p>
        ) : notReady ? (
          <p className="mt-4 text-[13px] text-ui-text-secondary">{notReady}</p>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            {saved?.last_error && (
              <div role="alert" className="flex items-start gap-2 rounded-[6px] bg-error-light px-3 py-2 text-[12px] text-error-dark">
                <CircleAlert className="mt-px size-4 shrink-0" aria-hidden /> <span>{saved.last_error}</span>
              </div>
            )}
            {!saved && (
              <p className="m-0 rounded-[6px] bg-info-light px-3 py-2 text-[12px] text-info-dark">
                Nothing saved yet — website leads currently go to {fallback.join(', ') || 'the default address'} from the platform’s default account.
              </p>
            )}

            <label className="flex flex-col gap-1"><span className={label}>Send website leads to (one address per line, or comma-separated)</span>
              <Textarea rows={3} value={form.recipients} placeholder={'al@tlines.us\nhamzag@trust-lines.com'} onChange={e => set({ recipients: e.target.value })} />
            </label>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <span className={label}>Send from</span>
                <Select aria-label="Send from" value={form.use_sender ? 'own' : 'default'} options={SENDER} onValueChange={v => set({ use_sender: v === 'own' })} />
              </div>
              {form.use_sender && (
                <>
                  <label className="flex flex-col gap-1"><span className={label}>Sender name</span>
                    <Input value={form.from_name} placeholder="Trust-Lines" onChange={e => set({ from_name: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1"><span className={label}>From address</span>
                    <Input type="email" value={form.from_email} onChange={e => set({ from_email: e.target.value, ...(form.smtp_user === form.from_email ? { smtp_user: e.target.value } : {}) })} />
                  </label>
                </>
              )}
            </div>

            {form.use_sender && (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div className="flex flex-col gap-1">
                    <span className={label}>Email provider</span>
                    <Select aria-label="Email provider" value={form.preset} options={SMTP_PRESETS.map(p => ({ value: p.value, label: p.label }))} onValueChange={v => pickPreset(v ?? 'custom')} />
                  </div>
                  <label className="flex flex-col gap-1"><span className={label}>SMTP server</span>
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
                  <label className="flex flex-col gap-1 md:col-span-2"><span className={label}>{hasPassword ? 'Password (leave empty to keep the saved one)' : 'Password / app password'}</span>
                    <Input type="password" autoComplete="new-password" value={form.smtp_pass} placeholder={hasPassword ? '•••••••• saved' : ''} onChange={e => set({ smtp_pass: e.target.value })} />
                  </label>
                </div>
                <p className="m-0 rounded-[6px] bg-info-light px-3 py-2 text-[12px] text-info-dark">{preset.help}</p>
              </>
            )}

            {needsKey && (
              <div role="alert" className="flex items-start gap-2 rounded-[6px] bg-warning-light px-3 py-2 text-[12px] text-warning-dark">
                <CircleAlert className="mt-px size-4 shrink-0" aria-hidden /> <span>This server has no valid APP_ENCRYPTION_KEY, so the password can’t be saved here.</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button loading={busy === 'test'} disabled={!!busy || needsKey} onClick={saveAndTest}><Send /> Save &amp; send test email</Button>
              <Button variant="secondary" loading={busy === 'save'} disabled={!!busy || needsKey} onClick={async () => { if (await save()) toast.success('Saved'); }}>Save</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
