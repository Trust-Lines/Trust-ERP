import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_READ_ROLES, MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';
import { getDropboxClient } from '@/lib/dropbox/client';
import { buildProspectFilesPath, sanitizeFileName } from '@/lib/marketing/prospectFiles';

type Params = { params: Promise<{ id: string; contactId: string }> };

const NOTE_COLS = 'id, prospect_contact_id, author_name, author_id, body, image_path, source_created_at, created_at';

export async function GET(_req: NextRequest, { params }: Params) {
  const { id, contactId } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data, error } = await admin.from('prospect_contact_notes')
    .select(NOTE_COLS).eq('prospect_contact_id', contactId).order('source_created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id, contactId } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data: contact } = await admin.from('prospect_contacts').select('id').eq('id', contactId).eq('prospect_id', id).maybeSingle();
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  const contentType = req.headers.get('content-type') ?? '';
  let body: string;
  let image: File | null = null;
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    body = String(form.get('body') ?? '').trim();
    image = form.get('image') as File | null;
  } else {
    const json = await req.json().catch(() => ({}));
    body = String(json.body ?? '').trim();
  }
  if (!body && !image) return NextResponse.json({ error: 'Write something or attach an image' }, { status: 400 });

  let imagePath: string | null = null;
  if (image && image.size > 0) {
    const { data: prospect } = await admin.from('prospects').select('id, display_name, region').eq('id', id).maybeSingle();
    if (!prospect) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    const safeName = sanitizeFileName(image.name);
    const path = `${buildProspectFilesPath(prospect.region, prospect.display_name, prospect.id)}/${safeName}`;
    const buffer = Buffer.from(await image.arrayBuffer());
    try {
      const res = await getDropboxClient().filesUpload({ path, contents: buffer, mode: { '.tag': 'add' }, autorename: true });
      imagePath = res.result.path_lower ?? path;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Dropbox upload failed';
      console.error('[contacts/notes POST image]', msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  const { data: authorProfile } = await admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  const now = new Date().toISOString();

  const { data: note, error } = await admin.from('prospect_contact_notes').insert({
    prospect_contact_id: contactId,
    author_id: user.id,
    author_name: authorProfile?.full_name ?? null,
    body: body || (image ? `[image: ${image.name}]` : ''),
    image_path: imagePath,
    source_created_at: now,
  }).select(NOTE_COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'prospect_contact.note_posted', resource: `prospect_contact_notes:${note.id}`, newValue: { prospect_contact_id: contactId } });
  return NextResponse.json({ note }, { status: 201 });
}
