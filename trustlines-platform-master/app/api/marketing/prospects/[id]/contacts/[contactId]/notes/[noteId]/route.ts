import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';

type Params = { params: Promise<{ id: string; contactId: string; noteId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, contactId, noteId } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as { body?: string } | null;
  const text = body?.body?.trim();
  if (!text) return NextResponse.json({ error: 'Write something' }, { status: 400 });

  const { data: contact } = await admin.from('prospect_contacts').select('id').eq('id', contactId).eq('prospect_id', id).maybeSingle();
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  const { data: existing } = await admin.from('prospect_contact_notes').select('id, author_id')
    .eq('id', noteId).eq('prospect_contact_id', contactId).maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  // Editable by its own author only — a manager who wants a bad comment gone still has
  // delete; this is specifically about letting someone fix their own typo/correction.
  if (existing.author_id !== user.id) return NextResponse.json({ error: 'Only the author can edit this' }, { status: 403 });

  const { data: note, error } = await admin.from('prospect_contact_notes')
    .update({ body: text, edited_at: new Date().toISOString() })
    .eq('id', noteId)
    .select('id, prospect_contact_id, author_name, author_id, body, image_path, source_created_at, created_at, edited_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'prospect_contact.note_edited', resource: `prospect_contact_notes:${noteId}` });
  return NextResponse.json({ note });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, contactId, noteId } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data: contact } = await admin.from('prospect_contacts').select('id').eq('id', contactId).eq('prospect_id', id).maybeSingle();
  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  const { data, error } = await admin.from('prospect_contact_notes').delete()
    .eq('id', noteId).eq('prospect_contact_id', contactId).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'prospect_contact.note_deleted', resource: `prospect_contact_notes:${noteId}` });
  return NextResponse.json({ ok: true });
}
