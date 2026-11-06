import nodemailer, { type Transporter } from 'nodemailer';
import { decryptToken } from '@/lib/crypto/secrets';
import { isEmail } from '@/lib/email/compose';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Settings → Website leads (migration 141): who every website submission is emailed to, and
// the mailbox it's sent from. Server only.

export interface LeadMailSettings {
  recipients: string[];
  from_name: string | null; from_email: string | null;
  smtp_host: string | null; smtp_port: number | null; smtp_secure: boolean; smtp_user: string | null;
  smtp_pass_enc: string | null;
  verified_at: string | null; last_error: string | null; updated_at: string | null;
}

/** Everything but the password, for the Settings page. */
export const PUBLIC_LEAD_MAIL_COLS = 'recipients, from_name, from_email, smtp_host, smtp_port, smtp_secure, smtp_user, verified_at, last_error, updated_at';
const ALL_COLS = `${PUBLIC_LEAD_MAIL_COLS}, smtp_pass_enc`;

/** Used until recipients are saved in Settings (or the table doesn't exist yet). */
export function fallbackRecipients(): string[] {
  const env = process.env.WEB_LEAD_NOTIFY_EMAILS?.split(',').map(s => s.trim()).filter(Boolean);
  return env?.length ? env : ['al@tlines.us'];
}

export const tableMissing = (e: { message: string; code?: string }) =>
  e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache/i.test(e.message);

/** null when nothing is saved yet or migration 141 isn't applied. Never throws. */
export async function loadLeadMailSettings(admin: any): Promise<LeadMailSettings | null> {
  try {
    const { data, error } = await admin.from('web_lead_mail_settings').select(ALL_COLS).eq('id', true).maybeSingle();
    if (error) { if (!tableMissing(error)) console.error('[lead-mail-settings]', error.message); return null; }
    return (data as LeadMailSettings | null) ?? null;
  } catch { return null; }
}

export const hasOwnSender = (s: LeadMailSettings | null): s is LeadMailSettings & { smtp_host: string; smtp_port: number; smtp_user: string; smtp_pass_enc: string; from_email: string } =>
  !!(s?.smtp_host && s.smtp_port && s.smtp_user && s.smtp_pass_enc && s.from_email);

export function leadTransport(s: { smtp_host: string; smtp_port: number; smtp_secure: boolean; smtp_user: string; smtp_pass_enc: string }): Transporter {
  return nodemailer.createTransport({
    host: s.smtp_host, port: s.smtp_port, secure: s.smtp_secure,
    requireTLS: !s.smtp_secure,
    auth: { user: s.smtp_user, pass: decryptToken(s.smtp_pass_enc) },
    connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000,
  });
}

export interface LeadMailInput {
  recipients: string[];
  from_name: string | null; from_email: string | null;
  smtp_host: string | null; smtp_port: number | null; smtp_secure: boolean; smtp_user: string | null;
  /** Only when changed; omitted = keep the stored one. '' with clearSender removes it. */
  smtp_pass?: string;
  clearSender: boolean;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const HOST_RE = /^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/i;

export function parseLeadMailSettings(raw: unknown, hasStoredPassword: boolean): { value: LeadMailInput } | { error: string } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(b.recipients) ? b.recipients : str(b.recipients).split(/[\s,;]+/);
  const recipients = [...new Set(list.map(x => str(x).toLowerCase()).filter(Boolean))];
  const bad = recipients.find(r => !isEmail(r));
  if (bad) return { error: `“${bad}” is not a valid email address` };
  if (!recipients.length) return { error: 'Add at least one email address to send website leads to' };
  if (recipients.length > 20) return { error: 'At most 20 recipients' };

  const useSender = b.use_sender === true;
  if (!useSender) {
    return { value: { recipients, from_name: null, from_email: null, smtp_host: null, smtp_port: null, smtp_secure: true, smtp_user: null, clearSender: true } };
  }
  const from_name = str(b.from_name) || 'TLINES';
  const from_email = str(b.from_email).toLowerCase();
  if (!isEmail(from_email)) return { error: 'Enter a valid “from” email address' };
  const smtp_host = str(b.smtp_host).toLowerCase();
  if (!HOST_RE.test(smtp_host)) return { error: 'Enter the SMTP server, e.g. smtp.purelymail.com' };
  const smtp_port = Number(b.smtp_port);
  if (!Number.isInteger(smtp_port) || smtp_port < 1 || smtp_port > 65535) return { error: 'Port must be a number such as 465 or 587' };
  const smtp_user = str(b.smtp_user);
  if (!smtp_user) return { error: 'The SMTP username is required (usually the email address)' };
  const pass = typeof b.smtp_pass === 'string' ? b.smtp_pass.trim() : '';
  if (!pass && !hasStoredPassword) return { error: 'The password (or app password) is required' };
  return {
    value: {
      recipients, from_name, from_email, smtp_host, smtp_port, smtp_secure: b.smtp_secure !== false, smtp_user,
      ...(pass ? { smtp_pass: pass } : {}), clearSender: false,
    },
  };
}
