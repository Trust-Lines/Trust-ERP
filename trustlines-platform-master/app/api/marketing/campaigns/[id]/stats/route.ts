import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_READ_ROLES, MARKETING_SEE_ALL_ROLES } from '@/lib/marketing/roles';
import { getCampaign, computeCampaignStats, listRecentSubmissions, CampaignError } from '@/lib/marketing/campaigns';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;

  const campaign = await getCampaign(admin, id);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (!MARKETING_SEE_ALL_ROLES.includes(role) && campaign.owner_user_id !== user.id && campaign.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const [stats, recentSubmissions] = await Promise.all([
      computeCampaignStats(admin, id),
      listRecentSubmissions(admin, id, 50),
    ]);
    return NextResponse.json({ stats, recentSubmissions });
  } catch (e) {
    const status = e instanceof CampaignError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status });
  }
}
