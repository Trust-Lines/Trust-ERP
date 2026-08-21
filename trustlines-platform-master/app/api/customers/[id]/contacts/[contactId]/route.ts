import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { CUSTOMER_WRITE_ROLES } from '@/lib/customers/roles';

type Params = { params: Promise<{ id: string; contactId: string }> };

const CONTACT_COLS = 'id, customer_id, name, title, role_type, email, phone, is_primary, is_authorized_approver, notes, created_at';
const EDITABLE = ['name', 'title', 'role_type', 'email', 'phone', 'is_primary', 'is_authorized_approver', 'notes'] as const;

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, contactId } = await params;
  const { user, admin, deny } = await requireRole(CUSTOMER_WRITE_ROLES);
  if (deny) return deny;

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
    await admin.from('customer_contacts').update({ is_primary: false })
      .eq('customer_id', id).eq('is_primary', true).neq('id', contactId).is('deleted_at', null);
  }

  const { data, error } = await admin.from('customer_contacts').update(patch)
    .eq('id', contactId).eq('customer_id', id).is('deleted_at', null)
    .select(CONTACT_COLS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'customer_contact.updated', resource: `customer_contact:${contactId}`, newValue: patch });
  return NextResponse.json({ contact: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, contactId } = await params;
  const { user, admin, deny } = await requireRole(CUSTOMER_WRITE_ROLES);
  if (deny) return deny;

  const { data, error } = await admin.from('customer_contacts')
    .update({ deleted_at: new Date().toISOString(), is_primary: false })
    .eq('id', contactId).eq('customer_id', id).is('deleted_at', null)
    .select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'customer_contact.deleted', resource: `customer_contact:${contactId}`, newValue: { customer_id: id } });
  return NextResponse.json({ ok: true });
}
