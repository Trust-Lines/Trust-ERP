import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { CUSTOMER_WRITE_ROLES } from '@/lib/customers/roles';

type Params = { params: Promise<{ id: string }> };

const CONTACT_COLS = 'id, customer_id, name, title, role_type, email, phone, is_primary, is_authorized_approver, notes, created_at';

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(CUSTOMER_WRITE_ROLES);
  if (deny) return deny;

  const { data: parent } = await admin.from('customers').select('id').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!parent) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

  const body = await req.json().catch(() => null) as {
    name?: string; title?: string; role_type?: string; email?: string; phone?: string;
    is_primary?: boolean; is_authorized_approver?: boolean; notes?: string;
  } | null;
  const name = body?.name?.trim();
  if (!name) return NextResponse.json({ error: 'Contact name is required' }, { status: 400 });

  const isPrimary = body?.is_primary === true;
  if (isPrimary) {
    await admin.from('customer_contacts').update({ is_primary: false })
      .eq('customer_id', id).eq('is_primary', true).is('deleted_at', null);
  }

  const { data, error } = await admin.from('customer_contacts').insert({
    customer_id: id,
    name,
    title:     body?.title?.trim()     || null,
    role_type: body?.role_type?.trim() || null,
    email:     body?.email?.trim()     || null,
    phone:     body?.phone?.trim()     || null,
    is_primary: isPrimary,
    is_authorized_approver: body?.is_authorized_approver === true,
    notes:     body?.notes?.trim()     || null,
    created_by: user.id,
  }).select(CONTACT_COLS).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'customer_contact.created', resource: `customer_contact:${data.id}`, newValue: { customer_id: id, name } });
  return NextResponse.json({ contact: data }, { status: 201 });
}
