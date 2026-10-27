import { randomBytes } from 'node:crypto';
import { appBaseUrl } from '@/lib/env/appUrl';
import { deriveSecret } from '@/lib/crypto/secrets';
import { renderTemplate, type MergeContact } from '@/lib/marketing/mailTemplates';
import {
  buildFilterContext, fetchAllMatching, hasAnyCriterion, type ProspectQueryParams,
} from '@/lib/marketing/prospectQuery';
import {
  addOpenPixel, htmlToText, isEmail, normalizeEmail, oneClickUnsubscribeUrl, openPixelUrl, renderHtml, textToHtml,
  trackLinks, unsubscribeUrl, withSignature, wrapCampaign, type TrackingLinks,
} from '@/lib/email/compose';
import {
  friendlySmtpError, fromHeader, isTemporarySmtpError, loadSender, sentLast24h, transportFor, type SenderSettings,
} from '@/lib/email/mailSettings';

/* eslint-disable @typescript-eslint/no-explicit-any */

// The sending engine behind one-to-one emails and email campaigns. Everything goes out through
// the sender's own SMTP login (lib/email/mailSettings.ts), inside their daily limit.
// Campaigns are queued (email_messages) and sent in small batches by the cron, so a big
// audience never trips the mailbox provider's rate limits or a serverless timeout.

/** Emails per sender per cron run (every 10 minutes → at most ~240/hour). */
export const BATCH_PER_RUN = 40;
/** Hard ceiling on a single campaign's audience. */
export const MAX_AUDIENCE = 5000;
const PAUSE_MS = 1500; // between two emails of a batch — mailbox providers dislike bursts

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const newToken = () => randomBytes(18).toString('base64url');
const short = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

export const footerAddress = () =>
  process.env.MAIL_FOOTER_ADDRESS?.trim() || 'Trust-Lines Design & Supply';

function tracking(token: string): TrackingLinks {
  return { baseUrl: appBaseUrl(), token, secret: deriveSecret('email-click') };
}

export class EmailError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

/** The stored sender, or an error the person can act on. */
async function requireSender(admin: any, userId: string): Promise<SenderSettings> {
  const s = await loadSender(admin, userId);
  if (!s) throw new EmailError('Set up your email account first: Settings → Email sending.', 412);
  return s;
}

async function suppressedSet(admin: any, emails: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < emails.length; i += 500) {
    const { data, error } = await admin.from('email_suppressions').select('email').in('email', emails.slice(i, i + 500));
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as { email: string }[]) out.add(r.email);
  }
  return out;
}

// ── Audience ─────────────────────────────────────────────────────────────────────────────

export interface Audience extends Partial<ProspectQueryParams> {
  /** Also email the people saved inside each Contact (prospect_contacts), not only its main address. */
  includePeople?: boolean;
}

export function audienceParams(a: Audience): ProspectQueryParams {
  return {
    q: a.q ?? '', status: a.status ?? '', region: a.region ?? '', sources: a.sources ?? [],
    completeness: a.completeness ?? '', includeArchived: false,
    campaignId: a.campaignId ?? '', surveyOnly: a.surveyOnly ?? false, projectStatus: a.projectStatus ?? '',
    followUpOverdue: a.followUpOverdue ?? false,
  };
}

export interface Recipient { prospect_id: string; email: string; name: string | null }
export interface AudienceResult { recipients: Recipient[]; matched: number; noEmail: number; suppressed: number }

/** Who a campaign would reach: the Contacts query, de-duplicated, minus unsubscribed/bounced addresses. */
export async function resolveAudience(admin: any, userId: string, role: string, a: Audience): Promise<AudienceResult> {
  const params = audienceParams(a);
  // Same rule as the Contacts page: no query, no list — a campaign to "everyone" must be a choice.
  if (!hasAnyCriterion(params)) throw new EmailError('Pick at least one audience filter.');
  const ctx = await buildFilterContext(admin, userId, role, params);
  if ('error' in ctx) throw new Error(ctx.error);
  const found = await fetchAllMatching<{ id: string; display_name: string; main_email: string | null }>(
    admin, 'prospects', 'id, display_name, main_email', ctx, MAX_AUDIENCE + 1,
  );
  if ('error' in found) throw new Error(found.error);
  if (found.rows.length > MAX_AUDIENCE) throw new EmailError(`More than ${MAX_AUDIENCE} Contacts match — narrow the audience.`);

  const byEmail = new Map<string, Recipient>();
  let noEmail = 0;
  for (const p of found.rows) {
    if (p.main_email && isEmail(p.main_email)) {
      const e = normalizeEmail(p.main_email);
      if (!byEmail.has(e)) byEmail.set(e, { prospect_id: p.id, email: e, name: null });
    } else if (!a.includePeople) {
      noEmail += 1;
    }
  }
  if (a.includePeople && found.rows.length) {
    const ids = found.rows.map(p => p.id);
    for (let i = 0; i < ids.length; i += 300) {
      const { data, error } = await admin.from('prospect_contacts').select('prospect_id, name, email').in('prospect_id', ids.slice(i, i + 300)).not('email', 'is', null);
      if (error) throw new Error(error.message);
      for (const c of (data ?? []) as { prospect_id: string; name: string; email: string }[]) {
        if (!isEmail(c.email)) continue;
        const e = normalizeEmail(c.email);
        if (!byEmail.has(e)) byEmail.set(e, { prospect_id: c.prospect_id, email: e, name: c.name || null });
      }
    }
    const reached = new Set([...byEmail.values()].map(r => r.prospect_id));
    noEmail = found.rows.filter(p => !reached.has(p.id)).length;
  }

  const suppressed = await suppressedSet(admin, [...byEmail.keys()]);
  const recipients = [...byEmail.values()].filter(r => !suppressed.has(r.email));
  return { recipients, matched: found.rows.length, noEmail, suppressed: suppressed.size };
}

// ── Merge data ───────────────────────────────────────────────────────────────────────────

const MERGE_COLS = 'id, display_name, organization_name, person_name, brand_name, industry, region, state, source_label, main_email';

async function mergeRows(admin: any, prospectIds: string[]): Promise<Map<string, MergeContact>> {
  const ids = [...new Set(prospectIds.filter(Boolean))];
  const out = new Map<string, MergeContact>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await admin.from('prospects').select(MERGE_COLS).in('id', ids.slice(i, i + 300));
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as (MergeContact & { id: string })[]) out.set(r.id, r);
  }
  return out;
}

/** The contact the merge fields read: the person's own name when the email goes to someone inside the Contact. */
function mergeFor(row: MergeContact | undefined, toEmail: string, toName: string | null): MergeContact {
  const base: MergeContact = row ?? { display_name: toName ?? toEmail };
  return { ...base, main_email: toEmail, ...(toName ? { person_name: toName } : {}) };
}

// ── Campaigns ────────────────────────────────────────────────────────────────────────────

interface CampaignRow {
  id: string; name: string; subject: string; preheader: string | null; body_html: string; audience: Audience;
  status: string; sender_user_id: string | null; scheduled_at: string | null;
}
const CAMPAIGN_COLS = 'id, name, subject, preheader, body_html, audience, status, sender_user_id, scheduled_at';

export function campaignProblems(c: Pick<CampaignRow, 'subject' | 'body_html'>): string | null {
  if (!c.subject.trim()) return 'Add a subject line.';
  if (!c.body_html.trim()) return 'Add the email content.';
  return null;
}

/** Freezes the audience into queued messages and starts sending (status → sending). */
export async function launchCampaign(admin: any, campaignId: string, userId: string, role: string): Promise<{ queued: number }> {
  const { data: c, error } = await admin.from('email_campaigns').select(CAMPAIGN_COLS).eq('id', campaignId).is('deleted_at', null).maybeSingle() as { data: CampaignRow | null; error: { message: string } | null };
  if (error) throw new Error(error.message);
  if (!c) throw new EmailError('Campaign not found', 404);
  if (!['draft', 'scheduled'].includes(c.status)) throw new EmailError('This campaign has already been sent or is sending.', 409);
  const problem = campaignProblems(c);
  if (problem) throw new EmailError(problem);
  await requireSender(admin, userId);

  const { recipients } = await resolveAudience(admin, userId, role, c.audience ?? {});
  if (!recipients.length) throw new EmailError('Nobody to send to — every matching Contact is missing an email or has unsubscribed.');

  // Claim the campaign first so a double click / the cron can't launch it twice.
  const { data: claimed } = await admin.from('email_campaigns')
    .update({ status: 'sending', sender_user_id: userId, started_at: new Date().toISOString(), recipient_count: recipients.length, last_error: null })
    .eq('id', campaignId).in('status', ['draft', 'scheduled']).select('id').maybeSingle();
  if (!claimed) throw new EmailError('This campaign has already been sent or is sending.', 409);

  for (let i = 0; i < recipients.length; i += 500) {
    const rows = recipients.slice(i, i + 500).map(r => ({
      kind: 'campaign', campaign_id: campaignId, prospect_id: r.prospect_id, sender_user_id: userId,
      to_email: r.email, to_name: r.name, subject: c.subject, status: 'queued', token: newToken(),
    }));
    const { error: insError } = await admin.from('email_messages').insert(rows);
    if (insError) {
      await admin.from('email_campaigns').update({ status: 'paused', last_error: `Could not queue the emails: ${insError.message}` }).eq('id', campaignId);
      throw new Error(insError.message);
    }
  }
  return { queued: recipients.length };
}

/** Sends the next batch of one campaign, inside the sender's daily limit. */
export async function sendCampaignBatch(admin: any, campaignId: string, max = BATCH_PER_RUN): Promise<{ sent: number; failed: number; done: boolean }> {
  const { data: c } = await admin.from('email_campaigns').select(CAMPAIGN_COLS).eq('id', campaignId).maybeSingle() as { data: CampaignRow | null };
  if (!c || c.status !== 'sending' || !c.sender_user_id) return { sent: 0, failed: 0, done: false };

  const sender = await loadSender(admin, c.sender_user_id);
  if (!sender) {
    await admin.from('email_campaigns').update({ status: 'paused', last_error: 'The sender removed their email settings. Set up Settings → Email sending, then resume.' }).eq('id', c.id);
    return { sent: 0, failed: 0, done: false };
  }
  const room = Math.max(0, sender.daily_limit - await sentLast24h(admin, sender.user_id));
  const take = Math.min(max, room);
  if (take === 0) {
    await admin.from('email_campaigns').update({ last_error: `Daily limit of ${sender.daily_limit} reached — sending continues automatically within 24 hours.` }).eq('id', c.id);
    return { sent: 0, failed: 0, done: false };
  }

  const { data: next } = await admin.from('email_messages').select('id').eq('campaign_id', c.id).eq('status', 'queued').order('created_at').limit(take);
  const ids = ((next ?? []) as { id: string }[]).map(r => r.id);
  let sent = 0, failed = 0;
  if (ids.length) {
    const { data: claimed } = await admin.from('email_messages').update({ status: 'sending', sender_user_id: sender.user_id }).in('id', ids).eq('status', 'queued')
      .select('id, prospect_id, to_email, to_name, token');
    const batch = (claimed ?? []) as { id: string; prospect_id: string | null; to_email: string; to_name: string | null; token: string }[];
    const suppressed = await suppressedSet(admin, batch.map(m => m.to_email));
    const merge = await mergeRows(admin, batch.map(m => m.prospect_id ?? ''));
    const transport = transportFor(sender, true);
    try {
      for (const [i, m] of batch.entries()) {
        if (suppressed.has(m.to_email)) {
          await admin.from('email_messages').update({ status: 'skipped', error: 'Unsubscribed before sending' }).eq('id', m.id);
          continue;
        }
        const contact = mergeFor(m.prospect_id ? merge.get(m.prospect_id) : undefined, m.to_email, m.to_name);
        const t = tracking(m.token);
        const html = addOpenPixel(trackLinks(wrapCampaign(renderHtml(c.body_html, contact), {
          preheader: c.preheader ? renderTemplate(c.preheader, contact) : null,
          footerAddress: footerAddress(), unsubscribeHref: unsubscribeUrl(t), fromName: sender.from_name,
        }), t), openPixelUrl(t));
        try {
          const info = await transport.sendMail({
            from: fromHeader(sender), replyTo: sender.reply_to ?? undefined,
            to: m.to_name ? { name: m.to_name, address: m.to_email } : m.to_email,
            subject: renderTemplate(c.subject, contact), html, text: htmlToText(html),
            headers: {
              'List-Unsubscribe': `<${oneClickUnsubscribeUrl(t)}>, <mailto:${sender.reply_to ?? sender.from_email}?subject=unsubscribe>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          });
          await admin.from('email_messages').update({ status: 'sent', sent_at: new Date().toISOString(), smtp_message_id: info.messageId ?? null, error: null }).eq('id', m.id);
          sent += 1;
        } catch (e) {
          if (isTemporarySmtpError(e)) {
            // Server is throttling: put this one and the rest back and try next run.
            const rest = batch.slice(i).map(x => x.id);
            await admin.from('email_messages').update({ status: 'queued' }).in('id', rest).eq('status', 'sending');
            await admin.from('email_campaigns').update({ last_error: friendlySmtpError(e) }).eq('id', c.id);
            break;
          }
          await admin.from('email_messages').update({ status: 'failed', error: friendlySmtpError(e) }).eq('id', m.id);
          failed += 1;
          if (failed >= 5 && sent === 0) {
            // Every email failing = a settings problem, not bad addresses: stop and tell the sender.
            const rest = batch.slice(i + 1).map(x => x.id);
            if (rest.length) await admin.from('email_messages').update({ status: 'queued' }).in('id', rest).eq('status', 'sending');
            await admin.from('email_campaigns').update({ status: 'paused', last_error: friendlySmtpError(e) }).eq('id', c.id);
            break;
          }
        }
        if (i < batch.length - 1) await sleep(PAUSE_MS);
      }
    } finally {
      transport.close();
    }
  }

  const { count: left } = await admin.from('email_messages').select('id', { count: 'exact', head: true })
    .eq('campaign_id', c.id).in('status', ['queued', 'sending']);
  const done = (left ?? 0) === 0;
  if (done) await admin.from('email_campaigns').update({ status: 'sent', finished_at: new Date().toISOString(), last_error: null }).eq('id', c.id).eq('status', 'sending');
  else if (sent > 0) await admin.from('email_campaigns').update({ last_error: null }).eq('id', c.id);
  return { sent, failed, done };
}

/** Cron: start due scheduled campaigns, then send a batch of every sending campaign. */
export async function runEmailQueue(admin: any) {
  // A batch cut off half-way (timeout, deploy) is not retried: the email may already be out.
  const stale = new Date(Date.now() - 15 * 60_000).toISOString();
  await admin.from('email_messages').update({ status: 'failed', error: 'Sending was interrupted — not retried to avoid a duplicate.' })
    .eq('status', 'sending').lt('updated_at', stale);

  const now = new Date().toISOString();
  const { data: due } = await admin.from('email_campaigns').select('id, sender_user_id')
    .eq('status', 'scheduled').is('deleted_at', null).lte('scheduled_at', now).limit(10);
  const started: { id: string; error?: string }[] = [];
  for (const c of (due ?? []) as { id: string; sender_user_id: string | null }[]) {
    try {
      if (!c.sender_user_id) throw new EmailError('No sender on the campaign');
      const { data: p } = await admin.from('profiles').select('role').eq('id', c.sender_user_id).maybeSingle();
      await launchCampaign(admin, c.id, c.sender_user_id, p?.role ?? '');
      started.push({ id: c.id });
    } catch (e) {
      await admin.from('email_campaigns').update({ status: 'paused', last_error: short(e) }).eq('id', c.id).eq('status', 'scheduled');
      started.push({ id: c.id, error: short(e) });
    }
  }

  const { data: sending } = await admin.from('email_campaigns').select('id').eq('status', 'sending').is('deleted_at', null).order('started_at').limit(20);
  const batches: { id: string; sent: number; failed: number; done: boolean }[] = [];
  for (const { id } of (sending ?? []) as { id: string }[]) {
    try { batches.push({ id, ...(await sendCampaignBatch(admin, id)) }); } catch (e) { console.error('[email queue]', id, short(e)); }
  }
  return { started, batches };
}

// ── One-to-one and test emails ───────────────────────────────────────────────────────────

export interface DirectEmail {
  prospectId: string;
  to: string;
  toName?: string | null;
  subject: string;
  body: string; // plain text or HTML
  includeSignature?: boolean;
}

/** Sends a one-to-one email from the person's own mailbox and logs it on the Contact. */
export async function sendDirectEmail(admin: any, userId: string, e: DirectEmail): Promise<{ id: string }> {
  const sender = await requireSender(admin, userId);
  if (!isEmail(e.to)) throw new EmailError('Enter a valid recipient email address.');
  const to = normalizeEmail(e.to);
  if ((await suppressedSet(admin, [to])).has(to)) throw new EmailError('This address has unsubscribed or bounced — it can’t be emailed from the ERP.', 409);
  if (await sentLast24h(admin, userId) >= sender.daily_limit) throw new EmailError(`You reached your daily limit of ${sender.daily_limit} emails.`, 429);

  const contact = mergeFor((await mergeRows(admin, [e.prospectId])).get(e.prospectId), to, e.toName ?? null);
  const subject = renderTemplate(e.subject.trim(), contact);
  const content = renderHtml(textToHtml(e.body), contact);
  const bodyHtml = e.includeSignature === false ? content : withSignature(content, sender.signature_html);
  const token = newToken();
  const { data: row, error } = await admin.from('email_messages').insert({
    kind: 'direct', prospect_id: e.prospectId, sender_user_id: userId, to_email: to, to_name: e.toName ?? null,
    subject, body_html: bodyHtml, status: 'sending', token,
  }).select('id').single();
  if (error) throw new Error(error.message);

  const t = tracking(token);
  const html = addOpenPixel(trackLinks(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1f2937">${bodyHtml}</body></html>`, t), openPixelUrl(t));
  const transport = transportFor(sender);
  try {
    const info = await transport.sendMail({
      from: fromHeader(sender), replyTo: sender.reply_to ?? undefined,
      to: e.toName ? { name: e.toName, address: to } : to, subject, html, text: htmlToText(bodyHtml),
    });
    await admin.from('email_messages').update({ status: 'sent', sent_at: new Date().toISOString(), smtp_message_id: info.messageId ?? null }).eq('id', row.id);
    return { id: row.id };
  } catch (err) {
    const message = friendlySmtpError(err);
    await admin.from('email_messages').update({ status: 'failed', error: message }).eq('id', row.id);
    throw new EmailError(message, 502);
  } finally {
    transport.close();
  }
}

/** Sends a campaign (or any content) to the person's own address, with a sample contact. */
export async function sendTestEmail(admin: any, userId: string, p: { subject: string; html: string; preheader?: string | null; campaign: boolean }) {
  const sender = await requireSender(admin, userId);
  const sample: MergeContact = { display_name: 'Acme Retail', organization_name: 'Acme Retail', person_name: 'Jordan Smith', industry: 'Retail', state: 'GA', main_email: sender.from_email };
  const content = renderHtml(p.html, sample);
  const html = p.campaign
    ? wrapCampaign(content, { preheader: p.preheader, footerAddress: footerAddress(), unsubscribeHref: `${appBaseUrl()}/unsubscribe/test`, fromName: sender.from_name })
    : withSignature(content, sender.signature_html);
  const transport = transportFor(sender);
  try {
    await transport.sendMail({ from: fromHeader(sender), to: sender.from_email, subject: `[Test] ${renderTemplate(p.subject || '(no subject)', sample)}`, html, text: htmlToText(html) });
  } catch (err) {
    throw new EmailError(friendlySmtpError(err), 502);
  } finally {
    transport.close();
  }
  return { to: sender.from_email };
}


