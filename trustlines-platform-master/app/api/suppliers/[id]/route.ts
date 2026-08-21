import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { SUPPLIER_READ_ROLES, SUPPLIER_WRITE_ROLES, computeTotals } from '@/lib/suppliers/config';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };

const PROFILE_COLS = 'id, code, name, country, is_active, email, phone, address, tax_office, tax_number, payment_terms, notes, created_at, updated_at';
const EDITABLE = ['name', 'country', 'email', 'phone', 'address', 'tax_office', 'tax_number', 'payment_terms', 'notes', 'is_active'] as const;
const INV_COLS = 'id, supplier_id, project_id, invoice_number, invoice_date, currency, amount, description, dropbox_path, status, created_at';
const PAY_COLS = 'id, supplier_id, invoice_id, project_id, currency, amount, paid_at, method, reference, notes, created_at';

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { admin, deny } = await requireRole([...SUPPLIER_READ_ROLES]);
  if (deny) return deny;

  const { data: supplier, error } = await admin.from('suppliers').select(PROFILE_COLS).eq('id', id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

  const [invRes, payRes] = await Promise.all([
    admin.from('supplier_invoices').select(INV_COLS).eq('supplier_id', id).is('deleted_at', null).order('invoice_date', { ascending: false, nullsFirst: false }),
    admin.from('supplier_payments').select(PAY_COLS).eq('supplier_id', id).is('deleted_at', null).order('paid_at', { ascending: false, nullsFirst: false }),
  ]);
  const invoices = invRes.data ?? [];
  const payments = payRes.data ?? [];

  return NextResponse.json({ supplier, invoices, payments, totals: computeTotals(invoices, payments) });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole([...SUPPLIER_WRITE_ROLES]);
  if (deny) return deny;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) {
    if (!(k in body)) continue;
    if (k === 'is_active') patch[k] = body[k] === true;
    else if (k === 'name') { const v = String(body[k] ?? '').trim(); if (!v) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 }); patch[k] = v; }
    else { const v = String(body[k] ?? '').trim(); patch[k] = v || null; }
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('suppliers').update(patch).eq('id', id).select(PROFILE_COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'supplier.updated', resource: `${data.code} — ${data.name}`, newValue: Object.keys(patch) });
  return NextResponse.json({ supplier: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole([...SUPPLIER_WRITE_ROLES]);
  if (deny) return deny;

  const { data, error } = await admin.from('suppliers').update({ is_active: false }).eq('id', id).select('code, name').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'supplier.deactivated', resource: `${data.code} — ${data.name}` });
  return NextResponse.json({ ok: true });
}
