import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCampaignBySlug } from '@/lib/marketing/campaigns';
import { publicCorsHeaders, publicCorsPreflight } from '@/lib/security/publicCors';

type Params = { params: Promise<{ slug: string }> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminDb = () => createAdminClient() as any;

export async function OPTIONS(req: NextRequest) {
  return publicCorsPreflight(req.headers.get('origin'));
}

export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const cors = publicCorsHeaders(req.headers.get('origin'));
  const admin = adminDb();

  const campaign = await getCampaignBySlug(admin, slug);
  if (!campaign) {
    return NextResponse.json({ error: 'Survey not found', errorCode: 'campaign_not_found' }, { status: 404, headers: cors });
  }

  return NextResponse.json({
    campaign: {
      slug: campaign.slug,
      name: campaign.public_title?.trim() || campaign.name,
      publicTitle: campaign.public_title,
      publicDescription: campaign.public_description,
      campaignType: campaign.campaign_type,
      city: campaign.city,
      country: campaign.country,
      startDate: campaign.start_date,
      endDate: campaign.end_date,
      defaultLanguage: campaign.default_language,
      consentTextVersion: campaign.consent_text_version,
      status: campaign.status,
      submissionOpen: campaign.status === 'active',
      surveyTemplate: campaign.survey_template ?? 'none',
    },
  }, { headers: cors });
}
