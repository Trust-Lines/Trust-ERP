import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_READ_ROLES, MARKETING_WRITE_ROLES, MARKETING_SEE_ALL_ROLES } from '@/lib/marketing/roles';
import { createCampaign, listCampaigns, publicSurveyUrl, publicSurveyPath, CampaignError, CAMPAIGN_TYPES } from '@/lib/marketing/campaigns';
import { SOURCES } from '@/lib/marketing/classification';
import type { CampaignType, LeadSource } from '@/types/database';

export async function GET(req: NextRequest) {
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? undefined;
  const campaignType = url.searchParams.get('campaignType') ?? undefined;
  const owner = url.searchParams.get('owner') ?? undefined;
  const q = url.searchParams.get('q') ?? undefined;

  try {
    const campaigns = await listCampaigns(admin, {
      status: status as never, campaignType: campaignType as never, ownerUserId: owner || undefined, q: q || undefined,
      scopeToUserId: MARKETING_SEE_ALL_ROLES.includes(role) ? undefined : user.id,
    });
    const withLinks = campaigns.map(c => ({
      ...c,
      publicPath: publicSurveyPath((c as { slug: string }).slug),
      publicUrl: publicSurveyUrl((c as { slug: string }).slug),
    }));
    return NextResponse.json({ campaigns: withLinks });
  } catch (e) {
    const status = e instanceof CampaignError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status });
  }
}

export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as {
    name?: string; code?: string; campaignType?: string; source?: string;
    city?: string; state?: string; country?: string; venue?: string; description?: string;
    startDate?: string; endDate?: string; defaultLanguage?: string; ownerUserId?: string;
    publicTitle?: string; publicDescription?: string; consentTextVersion?: string;
    surveyTemplate?: string;
  } | null;

  if (!body?.name?.trim()) return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 });
  if (!body.campaignType || !(CAMPAIGN_TYPES as string[]).includes(body.campaignType)) {
    return NextResponse.json({ error: 'Invalid campaign type' }, { status: 400 });
  }
  if (!body.source || !(SOURCES as string[]).includes(body.source)) {
    return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
  }

  try {
    const campaign = await createCampaign(admin, {
      name: body.name, code: body.code, campaignType: body.campaignType as CampaignType, source: body.source as LeadSource,
      city: body.city, state: body.state, country: body.country, venue: body.venue, description: body.description,
      startDate: body.startDate, endDate: body.endDate, defaultLanguage: body.defaultLanguage,
      ownerUserId: body.ownerUserId, publicTitle: body.publicTitle, publicDescription: body.publicDescription,
      consentTextVersion: body.consentTextVersion, surveyTemplate: body.surveyTemplate as never,
    }, user.id);

    await logAudit({ actorId: user.id, action: 'campaign.created', resource: `campaign:${campaign.id}`, newValue: { name: campaign.name, slug: campaign.slug } });

    return NextResponse.json({
      campaign: { ...campaign, publicPath: publicSurveyPath(campaign.slug), publicUrl: publicSurveyUrl(campaign.slug) },
    }, { status: 201 });
  } catch (e) {
    const status = e instanceof CampaignError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status });
  }
}
