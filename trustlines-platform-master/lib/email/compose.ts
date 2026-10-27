import { createHmac } from 'node:crypto';
import { mergeValues, type MergeContact } from '@/lib/marketing/mailTemplates';

// Pure helpers that turn a template + a contact into the email that actually goes out:
// merge fields (HTML-escaped), tracked links, the open pixel, the unsubscribe footer and a
// plain-text part. No I/O here, so it's all unit-tested.

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** {{token}} merge for HTML: values are escaped, so "A&B <Retail>" can't break the markup. */
export function renderHtml(html: string, contact: MergeContact): string {
  const values = mergeValues(contact);
  return html.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, token: string) => {
    const key = token.toLowerCase();
    return key in values ? escapeHtml(values[key]) : whole;
  });
}

const HTML_TAG_RE = /<\/?(p|div|br|a|span|strong|b|i|em|u|ul|ol|li|h[1-6]|table|tbody|tr|td|th|img|hr|html|body|center|font)\b[^>]*>/i;

/** Plain text typed in a box → simple HTML paragraphs. Text that already has tags is left as is. */
export function textToHtml(body: string): string {
  // Only real HTML tags count — "Hi <you>" typed in the box is text and gets escaped.
  if (HTML_TAG_RE.test(body)) return body;
  return body.split(/\n{2,}/).map(p => `<p style="margin:0 0 12px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
}

/** Readable plain-text alternative of an HTML email (spam filters and text-only clients want one). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const text = label.replace(/<[^>]+>/g, '').trim();
      return text && text !== href ? `${text} (${href})` : href;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Tracking ─────────────────────────────────────────────────────────────────────────────

/** HMAC over token + target URL, so the click redirect can't be abused as an open redirect. */
export function clickSignature(token: string, url: string, secret: string): string {
  return createHmac('sha256', secret).update(`${token}\n${url}`).digest('base64url').slice(0, 22);
}

export interface TrackingLinks {
  baseUrl: string; // the ERP's public address
  token: string;
  secret: string;
}

export const openPixelUrl = (t: TrackingLinks) => `${t.baseUrl}/api/public/email/open/${t.token}`;
export const unsubscribeUrl = (t: TrackingLinks) => `${t.baseUrl}/unsubscribe/${t.token}`;
export const oneClickUnsubscribeUrl = (t: TrackingLinks) => `${t.baseUrl}/api/public/email/unsubscribe/${t.token}`;
export function trackedClickUrl(t: TrackingLinks, url: string): string {
  return `${t.baseUrl}/api/public/email/click/${t.token}?u=${encodeURIComponent(url)}&s=${clickSignature(t.token, url, t.secret)}`;
}

/** Points every http(s) link through the click tracker, except the unsubscribe link itself. */
export function trackLinks(html: string, t: TrackingLinks): string {
  return html.replace(/(<a\s[^>]*?href=)(["'])(https?:\/\/[^"']+)\2/gi, (whole, start: string, q: string, href: string) => {
    const url = href.replace(/&amp;/g, '&');
    if (url.startsWith(`${t.baseUrl}/unsubscribe/`)) return whole;
    return `${start}${q}${escapeHtml(trackedClickUrl(t, url))}${q}`;
  });
}

// ── Campaign wrapper ─────────────────────────────────────────────────────────────────────

export interface CampaignFrame {
  preheader?: string | null;
  /** Company name + postal address — US CAN-SPAM requires a physical address in marketing email. */
  footerAddress: string;
  unsubscribeHref: string;
  /** Who it's from, shown in the footer ("You received this email from …"). */
  fromName: string;
}

/** Wraps campaign content in a light email shell with the preheader and the unsubscribe footer. */
export function wrapCampaign(contentHtml: string, f: CampaignFrame): string {
  const pre = f.preheader?.trim()
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(f.preheader.trim())}${'&nbsp;&zwnj;'.repeat(40)}</div>`
    : '';
  const body = /<body[\s>]/i.test(contentHtml) ? contentHtml.replace(/^[\s\S]*<body[^>]*>|<\/body>[\s\S]*$/gi, '') : contentHtml;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5">${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px"><tr><td style="padding:28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1f2937">
${body}
</td></tr></table>
<p style="max-width:600px;margin:16px auto 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#6b7280">
You received this email from ${escapeHtml(f.fromName)}. ${escapeHtml(f.footerAddress)}<br>
<a href="${escapeHtml(f.unsubscribeHref)}" style="color:#6b7280">Unsubscribe</a> from these emails.
</p>
</td></tr></table>
</body></html>`;
}

/** Adds the 1×1 open pixel just before </body> (or at the end). */
export function addOpenPixel(html: string, pixelUrl: string): string {
  const img = `<img src="${escapeHtml(pixelUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0">`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${img}</body>`) : html + img;
}

/** Appends the sender's signature to a one-to-one email. */
export function withSignature(html: string, signatureHtml: string | null | undefined): string {
  if (!signatureHtml?.trim()) return html;
  return `${html}<div style="margin-top:16px">${textToHtml(signatureHtml)}</div>`;
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;
export const isEmail = (v: unknown): v is string => typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v.trim());
export const normalizeEmail = (v: string) => v.trim().toLowerCase();
