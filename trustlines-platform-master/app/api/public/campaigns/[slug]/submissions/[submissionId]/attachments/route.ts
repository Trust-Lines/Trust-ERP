import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCampaignBySlug } from '@/lib/marketing/campaigns';
import { getDropboxClient } from '@/lib/dropbox/client';
import { sanitizeFileName } from '@/lib/marketing/prospectFiles';
import {
  SURVEY_ATTACHMENT_MAX_BYTES, SURVEY_ATTACHMENT_MAX_COUNT,
  buildSurveyAttachmentFolder, isAllowedAttachment, isImageAttachment,
} from '@/lib/marketing/surveyAttachments';
import { logAudit } from '@/lib/audit/log';
import { checkRateLimit, clientIp, hashIp } from '@/lib/security/rateLimit';
import { publicCorsHeaders, publicCorsPreflight } from '@/lib/security/publicCors';

type Params = { params: Promise<{ slug: string; submissionId: string }> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminDb = () => createAdminClient() as any;

const IP_LIMIT = 30;
const SUBMISSION_LIMIT = SURVEY_ATTACHMENT_MAX_COUNT + 3;
const WINDOW_SECONDS = 3600;

export async function OPTIONS(req: NextRequest) {
  return publicCorsPreflight(req.headers.get('origin'));
}

// Public, unauthenticated by design (the person at the booth has no account). The caller
// proves it owns the submission by sending the same random `submissionToken` the survey
// was submitted with — only that browser knows it.
export async function POST(req: NextRequest, { params }: Params) {
  const { slug, submissionId } = await params;
  const cors = publicCorsHeaders(req.headers.get('origin'));
  const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: cors });
  const admin = adminDb();

  const campaign = await getCampaignBySlug(admin, slug);
  if (!campaign) return fail('Survey not found', 404);

  const ipHash = await hashIp(clientIp(req.headers));
  const [ipLimit, subLimit] = await Promise.all([
    checkRateLimit(admin, `attach:ip:${ipHash}`, IP_LIMIT, WINDOW_SECONDS),
    checkRateLimit(admin, `attach:sub:${submissionId}`, SUBMISSION_LIMIT, WINDOW_SECONDS),
  ]);
  if (!ipLimit.allowed || !subLimit.allowed) return fail('Too many uploads — please try again shortly.', 429);

  let form: FormData;
  try { form = await req.formData(); } catch { return fail('Invalid upload', 400); }
  const token = String(form.get('token') ?? '').trim();
  const file = form.get('file');
  if (!token || !(file instanceof File) || file.size === 0) return fail('No file', 400);
  if (file.size > SURVEY_ATTACHMENT_MAX_BYTES) return fail('File is too large (max 4 MB).', 413);
  if (!isAllowedAttachment(file.name, file.type)) return fail('This file type is not supported.', 415);

  const { data: submission } = await admin.from('survey_submissions')
    .select('id, status, prospect_id')
    .eq('id', submissionId).eq('campaign_id', campaign.id).eq('idempotency_key', token).maybeSingle();
  if (!submission || submission.status !== 'processed' || !submission.prospect_id) return fail('Submission not found', 404);

  const prospectId = submission.prospect_id as string;
  const { data: prospect } = await admin.from('prospects')
    .select('id, display_name').eq('id', prospectId).is('deleted_at', null).maybeSingle();
  if (!prospect) return fail('Contact not found', 404);

  const isImage = isImageAttachment(file.name, file.type);
  const safeName = sanitizeFileName(file.name);
  const path = `${buildSurveyAttachmentFolder(prospect.display_name, prospect.id)}/${safeName}`;

  let dropboxPath: string;
  try {
    const res = await getDropboxClient().filesUpload({
      path, contents: Buffer.from(await file.arrayBuffer()), mode: { '.tag': 'add' }, autorename: true,
    });
    dropboxPath = res.result.path_lower ?? path;
  } catch (e) {
    console.error('[survey attachments POST] dropbox:', e instanceof Error ? e.message : e);
    return fail('Upload failed — please try again.', 502);
  }

  const { data: fileRow, error: fileErr } = await admin.from('prospect_files').insert({
    prospect_id: prospect.id, dropbox_path: dropboxPath, file_name: safeName, uploaded_by: null,
  }).select('id').single();
  if (fileErr) {
    console.error('[survey attachments POST] prospect_files:', fileErr.message);
    return fail('Upload failed — please try again.', 500);
  }

  // Activity feed entry: lives on the survey taker's contact (primary, else first).
  const { data: contacts } = await admin.from('prospect_contacts')
    .select('id, is_primary').eq('prospect_id', prospect.id)
    .order('is_primary', { ascending: false }).order('created_at', { ascending: true }).limit(1);
  const contactId = (contacts?.[0]?.id as string | undefined) ?? null;
  if (contactId) {
    const { error: noteErr } = await admin.from('prospect_contact_notes').insert({
      prospect_contact_id: contactId,
      author_name: 'Survey',
      body: isImage ? `Photo added at ${campaign.name}.` : `File added at ${campaign.name}: ${safeName}`,
      image_path: isImage ? dropboxPath : null,
      source_created_at: new Date().toISOString(),
    });
    if (noteErr) console.error('[survey attachments POST] note:', noteErr.message);
  }

  await logAudit({
    actorId: null, action: 'prospect_file.uploaded_via_survey', resource: `prospect_files:${fileRow.id}`,
    newValue: { prospect_id: prospect.id, submission_id: submissionId, file_name: safeName },
  });
  return NextResponse.json({ ok: true }, { status: 201, headers: cors });
}
