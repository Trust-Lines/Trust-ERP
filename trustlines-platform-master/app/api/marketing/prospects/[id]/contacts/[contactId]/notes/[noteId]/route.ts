import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';

type Params = { params: Promise<{ id: string; contactId: string; noteId: string }> };

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
