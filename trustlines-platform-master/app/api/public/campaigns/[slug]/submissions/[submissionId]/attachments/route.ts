import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCampaignBySlug } from '@/lib/marketing/campaigns';
import { getDropboxClient } from '@/lib/dropbox/client';
import { sanitizeFileName } from '@/lib/marketing/prospectFiles';
import {
  SURVEY_ATTACHMENT_CHUNK_BYTES, SURVEY_ATTACHMENT_MAX_BYTES, SURVEY_ATTACHMENT_MAX_COUNT,
  SURVEY_ATTACHMENT_SINGLE_MAX_BYTES,
  buildSurveyAttachmentFolder, isAllowedAttachment, isImageAttachment,
} from '@/lib/marketing/surveyAttachments';
import { logAudit } from '@/lib/audit/log';
import { checkRateLimit, clientIp, hashIp } from '@/lib/security/rateLimit';
import { publicCorsHeaders, publicCorsPreflight } from '@/lib/security/publicCors';

type Params = { params: Promise<{ slug: string; submissionId: string }> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminDb = () => createAdminClient() as any;

export const maxDuration = 60;

const WINDOW_SECONDS = 3600;
// One "file" = one single/start request; chunk requests are budgeted separately
// (200 MB / 4 MB = 50 chunks per file).
const FILES_PER_IP = 30;
const FILES_PER_SUBMISSION = SURVEY_ATTACHMENT_MAX_COUNT + 3;
const CHUNKS_PER_SUBMISSION = (SURVEY_ATTACHMENT_MAX_BYTES / SURVEY_ATTACHMENT_CHUNK_BYTES + 5) * SURVEY_ATTACHMENT_MAX_COUNT;

export async function OPTIONS(req: NextRequest) {
  return publicCorsPreflight(req.headers.get('origin'));
}

// Public, unauthenticated by design (the person at the booth has no account). The caller
// proves it owns the submission by sending the same random `submissionToken` the survey
// was submitted with — only that browser knows it.
//
// Modes (form field `action`):
//   single  (default) whole file in `file` (<= SURVEY_ATTACHMENT_SINGLE_MAX_BYTES)
//   start   first chunk of a big file  -> { sessionId }
//   append  middle chunk (sessionId, offset)
//   finish  last chunk (sessionId, offset, fileName) -> file is committed + recorded
export async function POST(req: NextRequest, { params }: Params) {
  const { slug, submissionId } = await params;
  const cors = publicCorsHeaders(req.headers.get('origin'));
  const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: cors });
  const admin = adminDb();

  const campaign = await getCampaignBySlug(admin, slug);
  if (!campaign) return fail('Survey not found', 404);

  let form: FormData;
  try { form = await req.formData(); } catch { return fail('Invalid upload', 400); }
  const action = String(form.get('action') ?? 'single');
  if (!['single', 'start', 'append', 'finish'].includes(action)) return fail('Invalid upload', 400);
  const token = String(form.get('token') ?? '').trim();
  const chunk = form.get('chunk') ?? form.get('file');
  if (!token || !(chunk instanceof File)) return fail('No file', 400);

  const ipHash = await hashIp(clientIp(req.headers));
  const limits = [checkRateLimit(admin, `attach:chunks:${submissionId}`, CHUNKS_PER_SUBMISSION, WINDOW_SECONDS)];
  if (action === 'single' || action === 'start') {
    limits.push(
      checkRateLimit(admin, `attach:ip:${ipHash}`, FILES_PER_IP, WINDOW_SECONDS),
      checkRateLimit(admin, `attach:sub:${submissionId}`, FILES_PER_SUBMISSION, WINDOW_SECONDS),
    );
  }
  if ((await Promise.all(limits)).some(l => !l.allowed)) return fail('Too many uploads — please try again shortly.', 429);

  const { data: submission } = await admin.from('survey_submissions')
    .select('id, status, prospect_id')
    .eq('id', submissionId).eq('campaign_id', campaign.id).eq('idempotency_key', token).maybeSingle();
  if (!submission || submission.status !== 'processed' || !submission.prospect_id) return fail('Submission not found', 404);

  const dbx = getDropboxClient();
  const bytes = async () => Buffer.from(await chunk.arrayBuffer());
  const bad = (e: unknown) => {
    console.error('[survey attachments POST] dropbox:', e instanceof Error ? e.message : e);
    return fail('Upload failed — please try again.', 502);
  };

  if (chunk.size > SURVEY_ATTACHMENT_CHUNK_BYTES + 1024) return fail('Chunk is too large.', 413);
  if (action === 'single' && chunk.size > SURVEY_ATTACHMENT_SINGLE_MAX_BYTES) return fail('File is too large for a single upload.', 413);

  const offset = Number(form.get('offset') ?? 0);
  if (action !== 'single' && (!Number.isFinite(offset) || offset < 0 || offset + chunk.size > SURVEY_ATTACHMENT_MAX_BYTES)) {
    return fail(`File is too large (max ${SURVEY_ATTACHMENT_MAX_BYTES / 1024 / 1024} MB).`, 413);
  }

  if (action === 'start') {
    const name = String(form.get('fileName') ?? '');
    if (!isAllowedAttachment(name)) return fail('This file type is not supported.', 415);
    try {
      const res = await dbx.filesUploadSessionStart({ close: false, contents: await bytes() });
      return NextResponse.json({ ok: true, sessionId: res.result.session_id }, { status: 201, headers: cors });
    } catch (e) { return bad(e); }
  }

  const sessionId = String(form.get('sessionId') ?? '');
  if (action === 'append') {
    if (!sessionId) return fail('Invalid upload', 400);
    try {
      await dbx.filesUploadSessionAppendV2({ cursor: { session_id: sessionId, offset }, close: false, contents: await bytes() });
      return NextResponse.json({ ok: true }, { status: 200, headers: cors });
    } catch (e) { return bad(e); }
  }

  // single | finish — commit the file, then record it.
  const mime = action === 'single' ? chunk.type : null;
  const originalName = action === 'single' ? (chunk.name || 'upload') : String(form.get('fileName') ?? '');
  if (!originalName || !isAllowedAttachment(originalName, mime)) return fail('This file type is not supported.', 415);

  const { data: prospect } = await admin.from('prospects')
    .select('id, display_name').eq('id', submission.prospect_id).is('deleted_at', null).maybeSingle();
  if (!prospect) return fail('Contact not found', 404);

  const isImage = isImageAttachment(originalName, mime);
  const safeName = sanitizeFileName(originalName);
  const path = `${buildSurveyAttachmentFolder(prospect.display_name, prospect.id)}/${safeName}`;

  let dropboxPath: string;
  try {
    if (action === 'single') {
      const res = await dbx.filesUpload({ path, contents: await bytes(), mode: { '.tag': 'add' }, autorename: true });
      dropboxPath = res.result.path_lower ?? path;
    } else {
      if (!sessionId) return fail('Invalid upload', 400);
      const res = await dbx.filesUploadSessionFinish({
        cursor: { session_id: sessionId, offset },
        commit: { path, mode: { '.tag': 'add' }, autorename: true },
        contents: await bytes(),
      });
      dropboxPath = res.result.path_lower ?? path;
    }
  } catch (e) { return bad(e); }

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
