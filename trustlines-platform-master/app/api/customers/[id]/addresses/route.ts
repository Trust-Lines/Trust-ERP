import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { CUSTOMER_WRITE_ROLES } from '@/lib/customers/roles';

type Params = { params: Promise<{ id: string }> };

const COLS = 'id, customer_id, label, address_type, line1, line2, city, state, postal_code, country, is_primary, notes, created_at';

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(CUSTOMER_WRITE_ROLES);
  if (deny) return deny;

  const { data: parent } = await admin.from('customers').select('id').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!parent) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

  const b = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  if (!String(b.line1 ?? '').trim() && !String(b.city ?? '').trim()) {
    return NextResponse.json({ error: 'Enter at least a street or city' }, { status: 400 });
  }

  const isPrimary = b.is_primary === true;
  if (isPrimary) {
    await admin.from('customer_addresses').update({ is_primary: false })
      .eq('customer_id', id).eq('is_primary', true).is('deleted_at', null);
  }

  const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string).trim() || null : null);
  const { data, error } = await admin.from('customer_addresses').insert({
    customer_id: id,
    label: str('label'), address_type: str('address_type'),
    line1: str('line1'), line2: str('line2'), city: str('city'), state: str('state'),
    postal_code: str('postal_code'), country: str('country'),
    is_primary: isPrimary, notes: str('notes'), created_by: user.id,
  }).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'customer_address.created', resource: `customer_address:${data.id}`, newValue: { customer_id: id } });
  return NextResponse.json({ address: data }, { status: 201 });
}
