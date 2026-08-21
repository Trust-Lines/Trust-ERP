import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { CUSTOMER_WRITE_ROLES } from '@/lib/customers/roles';

type Params = { params: Promise<{ id: string; addressId: string }> };

const COLS = 'id, customer_id, label, address_type, line1, line2, city, state, postal_code, country, is_primary, notes, created_at';
const EDITABLE = ['label', 'address_type', 'line1', 'line2', 'city', 'state', 'postal_code', 'country', 'is_primary', 'notes'] as const;

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, addressId } = await params;
  const { user, admin, deny } = await requireRole(CUSTOMER_WRITE_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) patch[k] = body[k];
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  if (patch.is_primary === true) {
    await admin.from('customer_addresses').update({ is_primary: false })
      .eq('customer_id', id).eq('is_primary', true).neq('id', addressId).is('deleted_at', null);
  }

  const { data, error } = await admin.from('customer_addresses').update(patch)
    .eq('id', addressId).eq('customer_id', id).is('deleted_at', null).select(COLS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Address not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'customer_address.updated', resource: `customer_address:${addressId}`, newValue: patch });
  return NextResponse.json({ address: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, addressId } = await params;
  const { user, admin, deny } = await requireRole(CUSTOMER_WRITE_ROLES);
  if (deny) return deny;

  const { data, error } = await admin.from('customer_addresses')
    .update({ deleted_at: new Date().toISOString(), is_primary: false })
    .eq('id', addressId).eq('customer_id', id).is('deleted_at', null).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Address not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'customer_address.deleted', resource: `customer_address:${addressId}`, newValue: { customer_id: id } });
  return NextResponse.json({ ok: true });
}
