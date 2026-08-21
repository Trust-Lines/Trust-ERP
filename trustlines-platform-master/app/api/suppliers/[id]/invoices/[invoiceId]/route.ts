import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { SUPPLIER_WRITE_ROLES, CURRENCIES } from '@/lib/suppliers/config';
import { syncInvoiceStatus } from '@/lib/suppliers/status';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string; invoiceId: string }> };
const INV_COLS = 'id, supplier_id, project_id, invoice_number, invoice_date, currency, amount, description, dropbox_path, status, created_at';
const EDITABLE = ['project_id', 'invoice_number', 'invoice_date', 'currency', 'amount', 'description', 'dropbox_path'] as const;

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, invoiceId } = await params;
  const { user, admin, deny } = await requireRole([...SUPPLIER_WRITE_ROLES]);
  if (deny) return deny;

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
    } else {
      const v = String(body[k] ?? '').trim(); patch[k] = v || null;
    }
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('supplier_invoices').update(patch).eq('id', invoiceId).eq('supplier_id', id).select(INV_COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if ('amount' in patch) await syncInvoiceStatus(admin, invoiceId);

  await logAudit({ actorId: user.id, action: 'supplier.invoice.updated', resource: `invoice:${invoiceId}`, newValue: Object.keys(patch) });
  return NextResponse.json({ invoice: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, invoiceId } = await params;
  const { user, admin, deny } = await requireRole([...SUPPLIER_WRITE_ROLES]);
  if (deny) return deny;

  const { error } = await admin.from('supplier_invoices').update({ deleted_at: new Date().toISOString() }).eq('id', invoiceId).eq('supplier_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'supplier.invoice.deleted', resource: `invoice:${invoiceId}` });
  return NextResponse.json({ ok: true });
}
