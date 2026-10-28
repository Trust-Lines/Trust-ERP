import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_READ_ROLES } from '@/lib/marketing/roles';
import { canSeeAllCampaigns } from '@/lib/email/campaignAccess';

type Params = { params: Promise<{ id: string }> };

// One sent email with what it said. One-to-one emails keep their own HTML; a campaign email
// shows the campaign's content (every recipient got the same, with their own merge values).
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;

  const { data: m, error } = await admin.from('email_messages')
    .select('id, kind, campaign_id, prospect_id, sender_user_id, to_email, to_name, subject, body_html, status, error, sent_at, opened_at, open_count, clicked_at, click_count, unsubscribed_at, created_at')
    .eq('id', id).neq('kind', 'test').maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not load the email' }, { status: 500 });
  if (!m || (!canSeeAllCampaigns(role) && m.sender_user_id !== user.id)) return NextResponse.json({ error: 'Email not found' }, { status: 404 });

  let body = m.body_html as string | null;
  let campaignName: string | null = null;
  if (!body && m.campaign_id) {
    const { data: c } = await admin.from('email_campaigns').select('name, body_html').eq('id', m.campaign_id).maybeSingle();
    body = c?.body_html ?? null;
    campaignName = c?.name ?? null;
  }
  const { data: events } = await admin.from('email_events').select('type, url, created_at').eq('message_id', id).order('created_at').limit(100);
  return NextResponse.json({ email: { ...m, body_html: body }, campaignName, events: events ?? [] });
}
