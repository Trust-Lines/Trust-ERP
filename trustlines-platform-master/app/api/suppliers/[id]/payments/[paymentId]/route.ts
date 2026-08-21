import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { SUPPLIER_WRITE_ROLES, CURRENCIES, PAYMENT_METHODS } from '@/lib/suppliers/config';
import { syncInvoiceStatus } from '@/lib/suppliers/status';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string; paymentId: string }> };
const PAY_COLS = 'id, supplier_id, invoice_id, project_id, currency, amount, paid_at, method, reference, notes, created_at';
const EDITABLE = ['invoice_id', 'project_id', 'currency', 'amount', 'paid_at', 'method', 'reference', 'notes'] as const;

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, paymentId } = await params;
  const { user, admin, deny } = await requireRole([...SUPPLIER_WRITE_ROLES]);
  if (deny) return deny;

  const { data: before } = await admin.from('supplier_payments').select('invoice_id').eq('id', paymentId).eq('supplier_id', id).maybeSingle();
  if (!before) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) {
    if (!(k in body)) continue;
    if (k === 'amount') {
      const n = Number(body[k]);
      if (!Number.isFinite(n) || n <= 0) return NextResponse.json({ error: 'A positive amount is required' }, { status: 400 });
      patch[k] = n;
    } else if (k === 'currency') {
      if (!CURRENCIES.includes(String(body[k]) as (typeof CURRENCIES)[number])) return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
      patch[k] = body[k];
    } else if (k === 'method') {
      if (!PAYMENT_METHODS.includes(String(body[k]) as (typeof PAYMENT_METHODS)[number])) return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
      patch[k] = body[k];
    } else {
      const v = String(body[k] ?? '').trim(); patch[k] = v || null;
    }
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('supplier_payments').update(patch).eq('id', paymentId).eq('supplier_id', id).select(PAY_COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await syncInvoiceStatus(admin, before.invoice_id);
  if ('invoice_id' in patch && patch.invoice_id !== before.invoice_id) await syncInvoiceStatus(admin, patch.invoice_id as string | null);

  await logAudit({ actorId: user.id, action: 'supplier.payment.updated', resource: `payment:${paymentId}`, newValue: Object.keys(patch) });
  return NextResponse.json({ payment: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, paymentId } = await params;
  const { user, admin, deny } = await requireRole([...SUPPLIER_WRITE_ROLES]);
  if (deny) return deny;

  const { data: before } = await admin.from('supplier_payments').select('invoice_id').eq('id', paymentId).eq('supplier_id', id).maybeSingle();
  if (!before) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

  const { error } = await admin.from('supplier_payments').update({ deleted_at: new Date().toISOString() }).eq('id', paymentId).eq('supplier_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await syncInvoiceStatus(admin, before.invoice_id);

  await logAudit({ actorId: user.id, action: 'supplier.payment.deleted', resource: `payment:${paymentId}` });
  return NextResponse.json({ ok: true });
}
