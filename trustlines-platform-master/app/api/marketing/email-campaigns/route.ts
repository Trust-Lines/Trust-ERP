import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_READ_ROLES, MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { EMAIL_CAMPAIGN_COLS, isNotReady, loadStats, parseCampaignPatch } from '@/lib/email/campaigns';
import { canSeeAllCampaigns } from '@/lib/email/campaignAccess';

export async function GET() {
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  let q = admin.from('email_campaigns').select(EMAIL_CAMPAIGN_COLS).is('deleted_at', null).order('created_at', { ascending: false }).limit(300);
  if (!canSeeAllCampaigns(role)) q = q.or(`created_by.eq.${user.id},sender_user_id.eq.${user.id}`);
  const { data, error } = await q;
  if (error) {
    if (isNotReady(error)) return NextResponse.json({ error: 'Email campaigns aren’t set up yet (migration 129).' }, { status: 503 });
    return NextResponse.json({ error: 'Could not load campaigns' }, { status: 500 });
  }
  const stats = await loadStats(admin, (data ?? []).map((c: { id: string }) => c.id));
  return NextResponse.json({ campaigns: data ?? [], stats: Object.fromEntries(stats) });
}

// New draft. Optional { audience, template_id, name } — Contacts' "Email these contacts" pre-fills the audience.
export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const parsed = parseCampaignPatch({ name: 'Untitled campaign', ...body });
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const draft: Record<string, unknown> = { ...parsed.value, status: 'draft', created_by: user.id, sender_user_id: user.id };
  if (parsed.value.template_id && !('body_html' in body)) {
    const { data: t } = await admin.from('mail_templates').select('name, subject, body_html').eq('id', parsed.value.template_id).is('deleted_at', null).maybeSingle();
    if (t) Object.assign(draft, { subject: t.subject, body_html: t.body_html, name: body.name ? draft.name : t.name });
  }
  const { data, error } = await admin.from('email_campaigns').insert(draft).select(EMAIL_CAMPAIGN_COLS).single();
  if (error) {
    console.error('[email campaign]', error.message);
    return NextResponse.json({ error: isNotReady(error) ? 'Email campaigns aren’t set up yet (migration 129).' : 'Could not create the campaign' }, { status: 500 });
  }
  await logAudit({ actorId: user.id, action: 'email_campaign.created', resource: `email_campaign:${data.id}`, newValue: { name: data.name } });
  return NextResponse.json({ campaign: data }, { status: 201 });
}
