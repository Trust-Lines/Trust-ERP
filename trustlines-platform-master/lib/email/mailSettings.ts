import nodemailer, { type Transporter } from 'nodemailer';
import { decryptToken } from '@/lib/crypto/secrets';
import { isEmail } from '@/lib/email/compose';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Each person's own mailbox (Settings → Email sending): the ERP sends their one-to-one emails
// and the campaigns they launch through it, so replies land in their own inbox.

export { SMTP_PRESETS } from '@/lib/email/presets';

export interface MailSettingsInput {
  from_name: string;
  from_email: string;
  reply_to: string | null;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  /** Only when changed; omitted = keep the stored one. */
  smtp_pass?: string;
  signature_html: string | null;
  daily_limit: number;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const HOST_RE = /^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/i;

export function parseMailSettings(raw: unknown, hasStoredPassword: boolean): { value: MailSettingsInput } | { error: string } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const from_name = str(b.from_name);
  if (!from_name) return { error: 'Your name is required' };
  const from_email = str(b.from_email).toLowerCase();
  if (!isEmail(from_email)) return { error: 'Enter a valid “from” email address' };
  const reply_to = str(b.reply_to).toLowerCase() || null;
  if (reply_to && !isEmail(reply_to)) return { error: 'Reply-to must be a valid email address' };
  const smtp_host = str(b.smtp_host).toLowerCase();
  if (!HOST_RE.test(smtp_host)) return { error: 'Enter the SMTP server, e.g. smtp.gmail.com' };
  const smtp_port = Number(b.smtp_port);
  if (!Number.isInteger(smtp_port) || smtp_port < 1 || smtp_port > 65535) return { error: 'Port must be a number such as 465 or 587' };
  const smtp_user = str(b.smtp_user);
  if (!smtp_user) return { error: 'The SMTP username is required (usually your email address)' };
  const pass = typeof b.smtp_pass === 'string' ? b.smtp_pass : '';
  if (!pass && !hasStoredPassword) return { error: 'The password (or app password) is required' };
  const daily_limit = Number(b.daily_limit ?? 400);
  if (!Number.isInteger(daily_limit) || daily_limit < 1 || daily_limit > 10000) return { error: 'Daily limit must be between 1 and 10,000' };
  const signature = typeof b.signature_html === 'string' ? b.signature_html.trim() : '';
  return {
    value: {
      from_name, from_email, reply_to, smtp_host, smtp_port, smtp_secure: b.smtp_secure === true, smtp_user,
      ...(pass ? { smtp_pass: pass } : {}),
      signature_html: signature ? signature.slice(0, 5000) : null, daily_limit,
    },
  };
}

export interface SenderSettings {
  user_id: string; from_name: string; from_email: string; reply_to: string | null;
  smtp_host: string; smtp_port: number; smtp_secure: boolean; smtp_user: string; smtp_pass_enc: string;
  signature_html: string | null; daily_limit: number; verified_at: string | null; last_error: string | null;
}
const SENDER_COLS = 'user_id, from_name, from_email, reply_to, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass_enc, signature_html, daily_limit, verified_at, last_error';
/** Same row without the password, for the Settings page. */
export const PUBLIC_MAIL_SETTINGS_COLS = 'from_name, from_email, reply_to, smtp_host, smtp_port, smtp_secure, smtp_user, signature_html, daily_limit, verified_at, last_error, updated_at';

export async function loadSender(admin: any, userId: string): Promise<SenderSettings | null> {
  const { data, error } = await admin.from('user_mail_settings').select(SENDER_COLS).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as SenderSettings | null;
}

export function transportFor(s: Pick<SenderSettings, 'smtp_host' | 'smtp_port' | 'smtp_secure' | 'smtp_user' | 'smtp_pass_enc'>, pool = false): Transporter {
  return nodemailer.createTransport({
    host: s.smtp_host,
    port: s.smtp_port,
    secure: s.smtp_secure,
    requireTLS: !s.smtp_secure, // never send a password over a connection that didn't upgrade to TLS
    auth: { user: s.smtp_user, pass: decryptToken(s.smtp_pass_enc) },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    ...(pool ? { pool: true, maxConnections: 1, maxMessages: 100 } : {}),
  });
}

export const fromHeader = (s: Pick<SenderSettings, 'from_name' | 'from_email'>) => ({ name: s.from_name, address: s.from_email });

/** Emails this person has sent in the last 24 hours (campaigns + one-to-one), for the daily limit. */
export async function sentLast24h(admin: any, userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count, error } = await admin.from('email_messages').select('id', { count: 'exact', head: true })
    .eq('sender_user_id', userId).eq('status', 'sent').gte('sent_at', since);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** SMTP errors in words people can act on. */
export function friendlySmtpError(e: unknown): string {
  const err = e as { code?: string; responseCode?: number; response?: string; message?: string };
  const text = `${err.response ?? ''} ${err.message ?? ''}`;
  if (err.code === 'EAUTH' || err.responseCode === 535 || /auth/i.test(text) && /fail|invalid|denied/i.test(text)) {
    return 'The mail server refused the username or password. For Gmail / Google Workspace use an App Password; for Microsoft 365 make sure SMTP AUTH is enabled for your mailbox.';
  }
  if (err.code === 'ECONNECTION' || err.code === 'ETIMEDOUT' || err.code === 'ESOCKET' || err.code === 'EDNS') {
    return 'Could not reach the mail server — check the server name, port and security setting (465 = SSL/TLS, 587 = STARTTLS).';
  }
  if (err.responseCode === 550 || err.responseCode === 553 || /sender|from address/i.test(text)) {
    return 'The mail server won’t send from this “from” address. Use the address of the mailbox you log in with (or an alias it’s allowed to use).';
  }
  if (err.responseCode === 421 || err.responseCode === 452 || err.responseCode === 454 || /limit|quota|too many/i.test(text)) {
    return 'The mail server says the sending limit was reached. Remaining emails will be retried later.';
  }
  return (err.message ?? 'Sending failed').slice(0, 300);
}

/** Temporary failures (rate limit, server busy): the message goes back in the queue instead of failing. */
export function isTemporarySmtpError(e: unknown): boolean {
  const err = e as { responseCode?: number; code?: string };
  return (err.responseCode !== undefined && err.responseCode >= 400 && err.responseCode < 500) || err.code === 'ETIMEDOUT' || err.code === 'ECONNECTION';
}

/**
 * The receiving server said the ADDRESS doesn't exist (a hard bounce at send time) — as opposed
 * to a problem with the sender's own login or limits. Those addresses go on the do-not-email
 * list, so nobody keeps mailing a dead address (which hurts the sender's reputation).
 */
export function isHardBounce(e: unknown): boolean {
  const err = e as { responseCode?: number; response?: string; message?: string; rejected?: unknown[] };
  const text = `${err.response ?? ''} ${err.message ?? ''}`;
  if (![550, 551, 553].includes(err.responseCode ?? 0) && !(Array.isArray(err.rejected) && err.rejected.length)) return false;
  return /user unknown|unknown user|no such user|does not exist|doesn't exist|mailbox (is )?unavailable|mailbox not found|invalid recipient|recipient (address )?rejected|address rejected|5\.1\.1|5\.1\.10/i.test(text);
}
