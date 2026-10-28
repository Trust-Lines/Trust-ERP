import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_MANAGE_ROLES, MARKETING_READ_ROLES, MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { EMAIL_CAMPAIGN_COLS, EMPTY_STATS, isEditable, loadStats, parseCampaignPatch } from '@/lib/email/campaigns';
import { loadCampaignFor } from '@/lib/email/campaignAccess';

type Params = { params: Promise<{ id: string }> };

// Campaign + totals + recipients (paged) + top links — the editor and the report read this.
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  const { campaign, deny: notFound } = await loadCampaignFor(admin, id, user.id, role);
  if (notFound) return notFound;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const filter = url.searchParams.get('filter') ?? '';
  let q = admin.from('email_messages')
    .select('id, prospect_id, to_email, to_name, status, error, sent_at, opened_at, open_count, clicked_at, click_count, unsubscribed_at', { count: 'exact' })
    .eq('campaign_id', id).order('to_email').range((page - 1) * 50, page * 50 - 1);
  if (filter === 'opened') q = q.not('opened_at', 'is', null);
  else if (filter === 'clicked') q = q.not('clicked_at', 'is', null);
  else if (filter === 'unsubscribed') q = q.not('unsubscribed_at', 'is', null);
  else if (['queued', 'sent', 'failed', 'skipped'].includes(filter)) q = q.eq('status', filter);
  const [{ data: recipients, count }, stats, { data: clickEvents }] = await Promise.all([
    q,
    loadStats(admin, [id]),
    admin.from('email_events').select('url, message_id, email_messages!inner(campaign_id)').eq('type', 'click').eq('email_messages.campaign_id', id).limit(5000),
  ]);
  const links = new Map<string, { clicks: number; people: Set<string> }>();
  for (const e of (clickEvents ?? []) as { url: string | null; message_id: string }[]) {
    if (!e.url) continue;
    const l = links.get(e.url) ?? { clicks: 0, people: new Set<string>() };
    l.clicks += 1; l.people.add(e.message_id); links.set(e.url, l);
  }
  const topLinks = [...links.entries()].map(([url, l]) => ({ url, clicks: l.clicks, people: l.people.size })).sort((a, b) => b.clicks - a.clicks).slice(0, 10);
  const { data: sender } = campaign.sender_user_id
    ? await admin.from('profiles').select('id, full_name, email').eq('id', campaign.sender_user_id).maybeSingle()
    : { data: null };

  return NextResponse.json({ campaign, stats: stats.get(id) ?? EMPTY_STATS(id), recipients: recipients ?? [], recipientTotal: count ?? 0, topLinks, sender });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const { campaign, deny: notFound } = await loadCampaignFor(admin, id, user.id, role);
  if (notFound) return notFound;

  const parsed = parseCampaignPatch(await req.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  // A sending or sent campaign can only be renamed — its content and audience are what went out.
  const patch = isEditable(campaign.status) ? parsed.value : { ...(parsed.value.name ? { name: parsed.value.name } : {}) };
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'This campaign has been sent — only its name can change.' }, { status: 409 });

  const { data, error } = await admin.from('email_campaigns').update(patch).eq('id', id).select(EMAIL_CAMPAIGN_COLS).single();
  if (error) return NextResponse.json({ error: 'Could not save the campaign' }, { status: 500 });
  return NextResponse.json({ campaign: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const { campaign, deny: notFound } = await loadCampaignFor(admin, id, user.id, role);
  if (notFound) return notFound;
  if (campaign.status === 'sending') return NextResponse.json({ error: 'Pause or cancel the campaign before deleting it.' }, { status: 409 });
  if (campaign.created_by !== user.id && !MARKETING_MANAGE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Only the person who created this campaign or a Marketing manager can delete it' }, { status: 403 });
  }
  const { error } = await admin.from('email_campaigns').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not delete the campaign' }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'email_campaign.deleted', resource: `email_campaign:${id}`, newValue: { name: campaign.name } });
  return NextResponse.json({ ok: true });
}
