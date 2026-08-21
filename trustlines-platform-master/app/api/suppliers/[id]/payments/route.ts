import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { SUPPLIER_WRITE_ROLES, CURRENCIES, PAYMENT_METHODS } from '@/lib/suppliers/config';
import { syncInvoiceStatus } from '@/lib/suppliers/status';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };
const PAY_COLS = 'id, supplier_id, invoice_id, project_id, currency, amount, paid_at, method, reference, notes, created_at';

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole([...SUPPLIER_WRITE_ROLES]);
  if (deny) return deny;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'A positive amount is required' }, { status: 400 });
  const currency = String(body.currency ?? 'USD');
  if (!CURRENCIES.includes(currency as (typeof CURRENCIES)[number])) return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
  const method = String(body.method ?? 'bank_transfer');
  if (!PAYMENT_METHODS.includes(method as (typeof PAYMENT_METHODS)[number])) return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });

  const { data: supplier } = await admin.from('suppliers').select('id').eq('id', id).maybeSingle();
  if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

  const invoiceId = str(body.invoice_id);
  let projectId = str(body.project_id);
  if (invoiceId) {
    const { data: inv } = await admin.from('supplier_invoices').select('supplier_id, project_id').eq('id', invoiceId).maybeSingle();
    if (!inv || inv.supplier_id !== id) return NextResponse.json({ error: 'Invoice does not belong to this supplier' }, { status: 400 });
    if (!projectId) projectId = inv.project_id;
  }

  const insert = {
    supplier_id: id, invoice_id: invoiceId, project_id: projectId,
    currency, amount, method,
    paid_at: str(body.paid_at),
    reference: str(body.reference),
    notes: str(body.notes),
    created_by: user.id,
  };
  const { data, error } = await admin.from('supplier_payments').insert(insert).select(PAY_COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await syncInvoiceStatus(admin, invoiceId);

  await logAudit({ actorId: user.id, action: 'supplier.payment.created', projectId: projectId ?? undefined, resource: `payment:${data.id}`, newValue: { amount, currency, method } });
  return NextResponse.json({ payment: data });
}

function str(v: unknown): string | null { const s = String(v ?? '').trim(); return s || null; }
