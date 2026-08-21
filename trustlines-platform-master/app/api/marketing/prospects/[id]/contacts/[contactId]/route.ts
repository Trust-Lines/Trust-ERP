import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';

type Params = { params: Promise<{ id: string; contactId: string }> };

const CONTACT_COLS = 'id, prospect_id, name, title, role_type, email, phone, linkedin_url, preferred_contact_method, '
  + 'is_decision_maker, is_primary, contact_consent, notes, other_contact, whatsapp, company2_phone, created_at';

const EDITABLE = [
  'name', 'title', 'role_type', 'email', 'phone', 'linkedin_url', 'preferred_contact_method',
  'is_decision_maker', 'is_primary', 'contact_consent', 'notes', 'other_contact', 'whatsapp', 'company2_phone',
] as const;

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, contactId } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) patch[k] = body[k];
  if ('name' in patch) {
    const name = String(patch.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'Contact name cannot be empty' }, { status: 400 });
    patch.name = name;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  if (patch.is_primary === true) {
    await admin.from('prospect_contacts').update({ is_primary: false })
      .eq('prospect_id', id).eq('is_primary', true).neq('id', contactId);
  }

  const { data, error } = await admin.from('prospect_contacts').update(patch)
    .eq('id', contactId).eq('prospect_id', id).select(CONTACT_COLS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'prospect_contact.updated', resource: `prospect_contact:${contactId}`, newValue: patch });
  return NextResponse.json({ contact: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, contactId } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data, error } = await admin.from('prospect_contacts')
    .delete().eq('id', contactId).eq('prospect_id', id).select('id, name').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'prospect_contact.deleted', resource: `prospect_contact:${contactId}`, newValue: { prospect_id: id, name: data.name } });
  return NextResponse.json({ ok: true });
}
