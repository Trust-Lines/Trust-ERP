import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { canAccessProspect } from '@/lib/marketing/prospectAccess';
import { getDropboxClient } from '@/lib/dropbox/client';
import { sanitizeFileName } from '@/lib/marketing/prospectFiles';
import { isImageAttachment } from '@/lib/marketing/surveyAttachments';
import { importPhotoFolder } from '@/lib/marketing/import/photos';

export const maxDuration = 60;

const MAX_BYTES = 4_000_000; // serverless request body cap — the browser shrinks bigger pictures first

// One picture from an imported Excel row → Dropbox + the Contact's Files tab + an Activity entry
// (so it shows on the card like a survey photo). Called by the import screen right after the
// Contact was created/merged. Add-only; a picture with the same content-derived name is skipped.
export async function POST(req: NextRequest) {
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: 'Invalid upload' }, { status: 400 }); }
  const prospectId = String(form.get('prospectId') ?? '');
  const contactId = String(form.get('contactId') ?? '');
  const campaignId = String(form.get('campaignId') ?? '');
  const caption = String(form.get('caption') ?? '').trim().slice(0, 160);
  const name = sanitizeFileName(String(form.get('name') ?? ''));
  const file = form.get('file');
  if (!prospectId || !(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'No picture' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Picture is too large (max 4 MB).' }, { status: 413 });
  if (!isImageAttachment(name, file.type)) return NextResponse.json({ error: 'Only pictures can be added here.' }, { status: 415 });

  // Same rule as editing the Contact: you can only add to Contacts you may edit.
  if (!(await canAccessProspect(admin, prospectId, user.id, role))) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data: prospect } = await admin.from('prospects')
    .select('id, display_name, person_name').eq('id', prospectId).is('deleted_at', null).maybeSingle();
  if (!prospect) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Importing the same file again must not pile up copies.
  const { data: existing } = await admin.from('prospect_files').select('id').eq('prospect_id', prospectId).eq('file_name', name).limit(1);
  if (existing?.length) return NextResponse.json({ ok: true, duplicate: true });

  let campaignName: string | null = null;
  if (campaignId) {
    const { data: c } = await admin.from('marketing_campaigns').select('name').eq('id', campaignId).maybeSingle();
    campaignName = c?.name ?? null;
  }

  let dropboxPath: string;
  try {
    const path = `${importPhotoFolder(campaignName, prospect.display_name, prospect.id)}/${name}`;
    const res = await getDropboxClient().filesUpload({ path, contents: Buffer.from(await file.arrayBuffer()), mode: { '.tag': 'add' }, autorename: true });
    dropboxPath = res.result.path_lower ?? path;
  } catch (e) {
    console.error('[import/photo] dropbox:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Dropbox upload failed.' }, { status: 502 });
  }

  const { data: fileRow, error: fileErr } = await admin.from('prospect_files').insert({
    prospect_id: prospectId, dropbox_path: dropboxPath, file_name: name, uploaded_by: user.id,
  }).select('id').single();
  if (fileErr) return NextResponse.json({ error: fileErr.message }, { status: 500 });

  // The Activity entry lives on the person the picture belongs to (else the primary / first / a new one).
  let noteContactId: string | null = null;
  if (contactId) {
    const { data: c } = await admin.from('prospect_contacts').select('id').eq('id', contactId).eq('prospect_id', prospectId).maybeSingle();
    noteContactId = c?.id ?? null;
  }
  if (!noteContactId) {
    const { data: list } = await admin.from('prospect_contacts').select('id')
      .eq('prospect_id', prospectId).order('is_primary', { ascending: false }).order('created_at', { ascending: true }).limit(1);
    noteContactId = list?.[0]?.id ?? null;
  }
  if (!noteContactId) {
    const { data: created } = await admin.from('prospect_contacts').insert({
      prospect_id: prospectId, name: prospect.person_name || prospect.display_name || 'Contact', is_primary: true, created_by: user.id,
    }).select('id').single();
    noteContactId = created?.id ?? null;
  }
  if (noteContactId) {
    const { error } = await admin.from('prospect_contact_notes').insert({
      prospect_contact_id: noteContactId, author_id: user.id, author_name: 'Excel import',
      body: `Photo imported from Excel${caption ? ` — ${caption}` : ''}.`, image_path: dropboxPath, source_created_at: new Date().toISOString(),
    });
    if (error) console.error('[import/photo] note:', error.message);
  }

  await logAudit({ actorId: user.id, action: 'prospect_file.uploaded_via_import', resource: `prospect_files:${fileRow.id}`, newValue: { prospect_id: prospectId, file_name: name } });
  return NextResponse.json({ ok: true });
}
