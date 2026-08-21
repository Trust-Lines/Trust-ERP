import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { SUPPLIER_WRITE_ROLES, CURRENCIES } from '@/lib/suppliers/config';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };
const INV_COLS = 'id, supplier_id, project_id, invoice_number, invoice_date, currency, amount, description, dropbox_path, status, created_at';

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole([...SUPPLIER_WRITE_ROLES]);
  if (deny) return deny;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'A positive amount is required' }, { status: 400 });
  const currency = String(body.currency ?? 'USD');
  if (!CURRENCIES.includes(currency as (typeof CURRENCIES)[number])) return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });

  const { data: supplier } = await admin.from('suppliers').select('id').eq('id', id).maybeSingle();
  if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

  const insert = {
    supplier_id: id,
    project_id: str(body.project_id),
    invoice_number: str(body.invoice_number),
    invoice_date: str(body.invoice_date),
    currency, amount,
    description: str(body.description),
    dropbox_path: str(body.dropbox_path),
    status: 'unpaid',
    created_by: user.id,
  };
  const { data, error } = await admin.from('supplier_invoices').insert(insert).select(INV_COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'supplier.invoice.created', projectId: insert.project_id ?? undefined, resource: `invoice:${data.id}`, newValue: { amount, currency } });
  return NextResponse.json({ invoice: data });
}

function str(v: unknown): string | null { const s = String(v ?? '').trim(); return s || null; }
