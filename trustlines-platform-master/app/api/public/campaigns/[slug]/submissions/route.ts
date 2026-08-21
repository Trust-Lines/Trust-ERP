import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCampaignBySlug } from '@/lib/marketing/campaigns';
import { processSurveySubmission, SubmissionValidationError, SubmissionProcessingError } from '@/lib/marketing/campaignSubmission';
import { checkRateLimit, clientIp, hashIp } from '@/lib/security/rateLimit';
import { publicCorsHeaders, publicCorsPreflight } from '@/lib/security/publicCors';

type Params = { params: Promise<{ slug: string }> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminDb = () => createAdminClient() as any;

const MAX_BODY_BYTES = 100_000;

const CAMPAIGN_LIMIT = 12;
const CAMPAIGN_WINDOW_SECONDS = 300;
const GLOBAL_LIMIT = 40;
const GLOBAL_WINDOW_SECONDS = 300;

export async function OPTIONS(req: NextRequest) {
  return publicCorsPreflight(req.headers.get('origin'));
}

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const cors = publicCorsHeaders(req.headers.get('origin'));
  const admin = adminDb();

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request too large', errorCode: 'payload_too_large' }, { status: 413, headers: cors });
  }
  let body: unknown = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body', errorCode: 'invalid_body' }, { status: 400, headers: cors });
  }

  const campaign = await getCampaignBySlug(admin, slug);
  if (!campaign) {
    return NextResponse.json({ error: 'Survey not found', errorCode: 'campaign_not_found' }, { status: 404, headers: cors });
  }
  if (campaign.status !== 'active') {
    const errorCode = campaign.status === 'draft' ? 'campaign_not_open' : `campaign_${campaign.status}`;
    return NextResponse.json({ error: 'This survey is not currently accepting responses.', errorCode }, { status: 409, headers: cors });
  }

  const ip = clientIp(req.headers);
  const ipHash = await hashIp(ip);
  const [globalLimit, campaignLimit] = await Promise.all([
    checkRateLimit(admin, `submit:global:${ipHash}`, GLOBAL_LIMIT, GLOBAL_WINDOW_SECONDS),
    checkRateLimit(admin, `submit:${campaign.id}:${ipHash}`, CAMPAIGN_LIMIT, CAMPAIGN_WINDOW_SECONDS),
  ]);
  if (!globalLimit.allowed || !campaignLimit.allowed) {
    return NextResponse.json({ error: 'Too many submissions — please try again shortly.', errorCode: 'rate_limited' }, { status: 429, headers: cors });
  }

  try {
    const outcome = await processSurveySubmission(admin, campaign, body);
    return NextResponse.json({ ok: true, submissionId: outcome.submissionId, status: outcome.status }, { status: 201, headers: cors });
  } catch (e) {
    if (e instanceof SubmissionValidationError) {
      return NextResponse.json({ error: e.message, errorCode: 'validation_error' }, { status: 400, headers: cors });
    }
    if (e instanceof SubmissionProcessingError) {
      console.error('[public survey submission] processing error:', e.message);
      return NextResponse.json({ error: 'Something went wrong. Please try again.', errorCode: 'processing_error' }, { status: 500, headers: cors });
    }
    console.error('[public survey submission] unexpected error:', e);
    return NextResponse.json({ error: 'Something went wrong. Please try again.', errorCode: 'unknown_error' }, { status: 500, headers: cors });
  }
}
