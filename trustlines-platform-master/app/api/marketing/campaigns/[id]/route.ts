import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_READ_ROLES, MARKETING_WRITE_ROLES, MARKETING_SEE_ALL_ROLES } from '@/lib/marketing/roles';
import { getCampaign, updateCampaign, publicSurveyUrl, publicSurveyPath, CampaignError, CAMPAIGN_TYPES } from '@/lib/marketing/campaigns';
import { SOURCES } from '@/lib/marketing/classification';

type Params = { params: Promise<{ id: string }> };

function canAccess(role: string, userId: string, campaign: { owner_user_id: string | null; created_by: string | null }): boolean {
  if (MARKETING_SEE_ALL_ROLES.includes(role)) return true;
  return campaign.owner_user_id === userId || campaign.created_by === userId;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;

  const campaign = await getCampaign(admin, id);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (!canAccess(role, user.id, campaign)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json({ campaign: { ...campaign, publicPath: publicSurveyPath(campaign.slug), publicUrl: publicSurveyUrl(campaign.slug) } });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  const existing = await getCampaign(admin, id);
  if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (!canAccess(role, user.id, existing)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  if (body.campaignType && !(CAMPAIGN_TYPES as string[]).includes(body.campaignType as string)) {
    return NextResponse.json({ error: 'Invalid campaign type' }, { status: 400 });
  }
  if (body.source && !(SOURCES as string[]).includes(body.source as string)) {
    return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
  }

  try {
    const campaign = await updateCampaign(admin, id, body);
    await logAudit({ actorId: user.id, action: 'campaign.updated', resource: `campaign:${id}`, newValue: body });
    return NextResponse.json({ campaign: { ...campaign, publicPath: publicSurveyPath(campaign.slug), publicUrl: publicSurveyUrl(campaign.slug) } });
  } catch (e) {
    const status = e instanceof CampaignError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status });
  }
}
