import { sendEmail } from '@/lib/email/send';
import { appBaseUrl } from '@/lib/env/appUrl';
import type { WebLeadInput } from './leads';
import { fallbackRecipients, hasOwnSender, leadTransport, loadLeadMailSettings, type LeadMailSettings } from './leadMailSettings';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Every website submission (contact form + newsletter) is also emailed, formatted, the moment
// it lands. Who gets it and which mailbox sends it are set in Settings → Website leads
// (web_lead_mail_settings, migration 141); until then WEB_LEAD_NOTIFY_EMAILS / al@tlines.us and
// the app's default SMTP account are used. Reply-To is the visitor.

export function webLeadRecipients(s: LeadMailSettings | null): string[] {
  return s?.recipients?.length ? s.recipients : fallbackRecipients();
}

/** One email through the Website-leads sender (or the default SMTP account). Throws on failure. */
export async function sendLeadMail(s: LeadMailSettings | null, to: string, subject: string, html: string, replyTo?: string): Promise<void> {
  if (!hasOwnSender(s)) { await sendEmail(to, subject, html, { replyTo }); return; }
  const transport = leadTransport(s);
  try {
    await transport.sendMail({ from: { name: s.from_name || 'Trust-Lines', address: s.from_email }, to, subject, html, ...(replyTo ? { replyTo } : {}) });
  } finally { transport.close(); }
}

// Everything in the mail comes from a public form — escape it all.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

function when(d: Date): string {
  return d.toLocaleString('en-US', {
    timeZone: 'Europe/Istanbul', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
}

function row(label: string, value: string | null | undefined, html?: string): string {
  if (!value) return '';
  return `<tr>
    <td style="color:#6b7280;padding:7px 12px 7px 0;width:130px;vertical-align:top;font-size:13px;">${esc(label)}</td>
    <td style="color:#111827;padding:7px 0;font-size:13.5px;font-weight:600;vertical-align:top;">${html ?? esc(value)}</td>
  </tr>`;
}

function block(label: string, value: string | null | undefined): string {
  if (!value) return '';
  return `<div style="margin-top:16px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:.06em;color:#6b7280;text-transform:uppercase;margin-bottom:6px;">${esc(label)}</div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;font-size:13.5px;color:#111827;line-height:1.6;white-space:pre-wrap;">${esc(value)}</div>
  </div>`;
}

export function webLeadEmail(lead: WebLeadInput, receivedAt: Date): { subject: string; html: string } {
  const isNewsletter = lead.kind === 'newsletter';
  const who = lead.company || lead.name || lead.email || 'Website visitor';
  const subject = isNewsletter
    ? `New newsletter signup: ${lead.email ?? ''}`.trim()
    : `New website lead: ${who}${lead.company && lead.name ? ` (${lead.name})` : ''}`;

  const email = lead.email && EMAIL_RE.test(lead.email) ? lead.email : null;
  const phoneHref = lead.phone ? lead.phone.replace(/[^\d+]/g, '') : '';
  const utm = lead.utm ? Object.entries(lead.utm).map(([k, v]) => `${k}=${v}`).join(', ') : null;
  const link = `${appBaseUrl()}/marketing/website?tab=leads`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="font-family:Inter,Arial,sans-serif;background:#f4f4f5;margin:0;padding:32px 16px;">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:#0d9488;padding:22px 28px;">
      <div style="font-size:18px;font-weight:700;color:#ffffff;">Trust-Lines</div>
      <div style="font-size:12.5px;color:rgba(255,255,255,0.85);margin-top:3px;">${isNewsletter ? 'New newsletter signup' : 'New website contact form submission'}</div>
    </div>
    <div style="padding:24px 28px 8px;">
      <div style="font-size:19px;font-weight:700;color:#111827;">${esc(isNewsletter ? (lead.email ?? 'Newsletter signup') : who)}</div>
      <div style="font-size:12.5px;color:#6b7280;margin-top:4px;">Received ${esc(when(receivedAt))}</div>

      <table style="width:100%;border-collapse:collapse;margin-top:18px;border-top:1px solid #f0f0f0;">
        ${row('Name', lead.name)}
        ${row('Company', lead.company)}
        ${row('Email', lead.email, email ? `<a href="mailto:${esc(email)}" style="color:#0d9488;text-decoration:none;">${esc(email)}</a>` : undefined)}
        ${row('Phone', lead.phone, phoneHref ? `<a href="tel:${esc(phoneHref)}" style="color:#0d9488;text-decoration:none;">${esc(lead.phone ?? '')}</a>` : undefined)}
        ${row('Store location', lead.store_location)}
        ${row('Store condition', lead.store_condition)}
        ${row('Store type', lead.store_type)}
      </table>

      ${block('Message', lead.message)}
      ${block('Notes', lead.notes)}

      <div style="margin:24px 0 8px;">
        <a href="${esc(link)}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:7px;">Open in Website Leads →</a>
        ${email ? `<a href="mailto:${esc(email)}" style="display:inline-block;margin-left:8px;color:#0d9488;text-decoration:none;font-size:14px;font-weight:600;padding:11px 14px;">Reply</a>` : ''}
      </div>
    </div>
    <div style="padding:14px 28px;border-top:1px solid #f0f0f0;font-size:11.5px;color:#9ca3af;line-height:1.6;">
      Privacy notice accepted${lead.consent_text_version ? ` (v${esc(lead.consent_text_version)})` : ''}
      ${lead.source_page ? ` · from ${esc(lead.source_page)}` : ''}${utm ? ` · ${esc(utm)}` : ''}<br />
      Trust-Lines Design and Supply · This is an automated message.
    </div>
  </div>
</body>
</html>`;

  return { subject, html };
}

/** Never throws — a mail failure must not fail the visitor's submission. */
export async function emailWebLead(admin: any, lead: WebLeadInput, receivedAt = new Date()): Promise<void> {
  try {
    const settings = await loadLeadMailSettings(admin);
    const { subject, html } = webLeadEmail(lead, receivedAt);
    const replyTo = lead.email && EMAIL_RE.test(lead.email) ? lead.email : undefined;
    const results = await Promise.all(webLeadRecipients(settings).map(to =>
      sendLeadMail(settings, to, subject, html, replyTo).then(() => null, e => {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[web-leads] email to', to, 'failed:', msg);
        return msg;
      }),
    ));
    // Show a sending problem on Settings → Website leads instead of failing silently.
    const failure = results.find(Boolean);
    if (settings) await admin.from('web_lead_mail_settings').update({ last_error: failure ? `Last lead email failed: ${failure}`.slice(0, 500) : null }).eq('id', true);
  } catch (e) {
    console.error('[web-leads] email failed:', e instanceof Error ? e.message : e);
  }
}
