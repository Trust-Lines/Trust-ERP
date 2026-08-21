import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { CUSTOMER_READ_ROLES, CUSTOMER_WRITE_ROLES } from '@/lib/customers/roles';

type Params = { params: Promise<{ id: string }> };

const EDITABLE = ['name', 'code', 'industry', 'email', 'phone', 'website', 'tax_id', 'status', 'notes', 'is_archived'] as const;

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { admin, deny } = await requireRole(CUSTOMER_READ_ROLES);
  if (deny) return deny;

  const { data: customer, error } = await admin.from('customers')
    .select('id, name, code, industry, email, phone, website, tax_id, status, notes, is_archived, created_at, updated_at')
    .eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

  const { data: contacts } = await admin.from('customer_contacts')
    .select('id, customer_id, name, title, role_type, email, phone, is_primary, is_authorized_approver, notes, created_at')
    .eq('customer_id', id).is('deleted_at', null).order('is_primary', { ascending: false }).order('name');

  return NextResponse.json({ customer, contacts: contacts ?? [] });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(CUSTOMER_WRITE_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) patch[k] = body[k];

  if ('name' in patch) {
    const name = String(patch.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'Customer name cannot be empty' }, { status: 400 });
    const safeName = name.replace(/[%,()\\]/g, '\\$&');
    const { data: dup } = await admin.from('customers')
      .select('id').is('deleted_at', null).ilike('name', safeName).neq('id', id).limit(1);
    if (dup && dup.length) return NextResponse.json({ error: `Another customer named "${name}" already exists` }, { status: 409 });
    patch.name = name;
  }
  if ('status' in patch && !['active', 'inactive', 'prospect'].includes(String(patch.status))) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('customers').update(patch).eq('id', id).is('deleted_at', null)
    .select('id, name, code, industry, email, phone, website, tax_id, status, notes, is_archived, created_at, updated_at').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'customer.updated', resource: `customer:${id}`, newValue: patch });
  return NextResponse.json({ customer: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(CUSTOMER_WRITE_ROLES);
  if (deny) return deny;

  const { data, error } = await admin.from('customers')
    .update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null)
    .select('id, name').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'customer.deleted', resource: `customer:${id}`, newValue: { name: data.name } });
  return NextResponse.json({ ok: true });
}
