import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES, MARKETING_SEE_ALL_ROLES } from '@/lib/marketing/roles';
import { getCampaign, setCampaignStatus, publicSurveyUrl, publicSurveyPath, CampaignError } from '@/lib/marketing/campaigns';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  const existing = await getCampaign(admin, id);
  if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (!MARKETING_SEE_ALL_ROLES.includes(role) && existing.owner_user_id !== user.id && existing.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const campaign = await setCampaignStatus(admin, id, 'paused');
    await logAudit({ actorId: user.id, action: 'campaign.paused', resource: `campaign:${id}` });
    return NextResponse.json({ campaign: { ...campaign, publicPath: publicSurveyPath(campaign.slug), publicUrl: publicSurveyUrl(campaign.slug) } });
  } catch (e) {
    const status = e instanceof CampaignError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status });
  }
}
