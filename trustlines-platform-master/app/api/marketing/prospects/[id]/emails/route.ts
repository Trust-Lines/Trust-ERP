import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_READ_ROLES, MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';
import { EmailError, sendDirectEmail } from '@/lib/email/sender';

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

// Email history of one Contact (one-to-one + campaigns) and "Send email" from the sender's own mailbox.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role, 'read');
  if (denied) return denied;

  const { data, error } = await admin.from('email_messages')
    .select('id, kind, campaign_id, sender_user_id, to_email, to_name, subject, body_html, status, error, sent_at, opened_at, open_count, clicked_at, click_count, unsubscribed_at, created_at')
    .eq('prospect_id', id).neq('kind', 'test').order('created_at', { ascending: false }).limit(200);
  if (error) {
    const notReady = error.code === 'PGRST205' || error.code === '42P01';
    return NextResponse.json({ error: notReady ? 'Email isn’t set up yet (migration 129).' : 'Could not load the emails' }, { status: notReady ? 503 : 500 });
  }
  const rows = (data ?? []) as { sender_user_id: string | null; campaign_id: string | null }[];
  const senderIds = [...new Set(rows.map(r => r.sender_user_id).filter(Boolean))];
  const campaignIds = [...new Set(rows.map(r => r.campaign_id).filter(Boolean))];
  const [{ data: people }, { data: campaigns }] = await Promise.all([
    senderIds.length ? admin.from('profiles').select('id, full_name, email').in('id', senderIds) : { data: [] },
    campaignIds.length ? admin.from('email_campaigns').select('id, name').in('id', campaignIds) : { data: [] },
  ]);
  const { data: suppressed } = await admin.from('prospects').select('main_email').eq('id', id).maybeSingle();
  const main = (suppressed?.main_email as string | null)?.toLowerCase();
  const { data: sup } = main ? await admin.from('email_suppressions').select('email, reason, created_at').eq('email', main).maybeSingle() : { data: null };
  return NextResponse.json({ emails: data ?? [], senders: people ?? [], campaigns: campaigns ?? [], suppression: sup ?? null });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role, 'read');
  if (denied) return denied;

  const b = await req.json().catch(() => null) as { to?: string; toName?: string; subject?: string; body?: string; includeSignature?: boolean } | null;
  if (!b?.to || !b.subject?.trim() || !b.body?.trim()) return NextResponse.json({ error: 'Recipient, subject and message are required' }, { status: 400 });
  if (b.subject.length > 250 || b.body.length > 100_000) return NextResponse.json({ error: 'The email is too long' }, { status: 400 });

  try {
    const sent = await sendDirectEmail(admin, user.id, {
      prospectId: id, to: b.to, toName: b.toName?.trim() || null, subject: b.subject, body: b.body, includeSignature: b.includeSignature !== false,
    });
    await logAudit({ actorId: user.id, action: 'email.sent', resource: `prospect:${id}`, newValue: { to: b.to, subject: b.subject, message: sent.id } });
    return NextResponse.json({ ok: true, id: sent.id });
  } catch (e) {
    if (e instanceof EmailError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[direct email]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Could not send the email' }, { status: 500 });
  }
}
