import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit, clientIp, hashIp } from '@/lib/security/rateLimit';
import { publicCorsHeaders, publicCorsPreflight } from '@/lib/security/publicCors';
import { notifyUsers, usersWithRoles } from '@/lib/events/notify';
import { parseWebLeadBody } from '@/lib/web-cms/leads';

// Public intake for the website's contact form and newsletter box. Writes to web_leads only —
// a separate inbox, never prospects. Origins allowed by PUBLIC_SURVEY_ORIGINS (same list the
// survey endpoint uses).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminDb = () => createAdminClient() as any;

const MAX_BODY_BYTES = 20_000;
const IP_LIMIT = 5;
const IP_WINDOW_SECONDS = 600;
const GLOBAL_LIMIT = 60;
const GLOBAL_WINDOW_SECONDS = 600;

export async function OPTIONS(req: NextRequest) {
  return publicCorsPreflight(req.headers.get('origin'));
}

export async function POST(req: NextRequest) {
  const cors = publicCorsHeaders(req.headers.get('origin'));
  const fail = (status: number, code: string, error: string) =>
    NextResponse.json({ error, errorCode: code }, { status, headers: cors });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return fail(413, 'payload_too_large', 'Request too large');
  let body: unknown = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* handled below */ }
  if (!body || typeof body !== 'object') return fail(400, 'invalid_body', 'Invalid request body');

  const admin = adminDb();
  const ipHash = await hashIp(clientIp(req.headers));
  const [perIp, global] = await Promise.all([
    checkRateLimit(admin, `weblead:ip:${ipHash}`, IP_LIMIT, IP_WINDOW_SECONDS),
    checkRateLimit(admin, 'weblead:global', GLOBAL_LIMIT, GLOBAL_WINDOW_SECONDS),
  ]);
  if (!perIp.allowed || !global.allowed) return fail(429, 'rate_limited', 'Too many submissions — please try again shortly.');

  const parsed = parseWebLeadBody(body);
  if ('error' in parsed) return fail(400, parsed.code, parsed.error);

  // Bots that fill the hidden field get a normal-looking success and nothing is stored.
  if (parsed.honeypot) return NextResponse.json({ ok: true }, { status: 201, headers: cors });

  const { lead } = parsed;
  const { data, error } = await admin.from('web_leads').insert({
    ...lead,
    consent_at: new Date().toISOString(),
    ip_hash: ipHash,
  }).select('id').single();
  if (error) {
    console.error('[web-leads] insert failed:', error.message);
    return fail(500, 'processing_error', 'Something went wrong. Please try again.');
  }

  // Ping marketing; a failure here must never fail the visitor's submission.
  try {
    const who = lead.company || lead.name || lead.email || 'Someone';
    const recipients = await usersWithRoles(admin, ['marketing_manager']);
    await notifyUsers(admin, {
      userIds: recipients, projectId: null, type: 'web_lead.new',
      title: lead.kind === 'newsletter' ? 'New newsletter signup' : `New website lead: ${who}`,
      body: lead.kind === 'newsletter' ? `${lead.email} subscribed on the website.` : `${who} sent the website contact form.`,
      link: '/marketing/website?tab=leads',
    });
  } catch (e) {
    console.error('[web-leads] notify failed:', e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ ok: true, id: data.id }, { status: 201, headers: cors });
}
