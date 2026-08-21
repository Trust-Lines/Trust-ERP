import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { suggestVendorCode } from '@/lib/production/vendorCode';
import { SUPPLIER_READ_ROLES, SUPPLIER_WRITE_ROLES, computeTotals, type CurrencyTotals } from '@/lib/suppliers/config';

export const dynamic = 'force-dynamic';

const PROFILE_COLS = 'id, code, name, country, is_active, email, phone, address, tax_office, tax_number, payment_terms, notes, created_at';

export async function GET() {
  const { admin, deny } = await requireRole([...SUPPLIER_READ_ROLES]);
  if (deny) return deny;

  const { data: suppliers, error } = await admin.from('suppliers').select(PROFILE_COLS).order('name', { ascending: true });
  if (error) return NextResponse.json({ suppliers: [], schemaError: error.message });

  const [inv, pay] = await Promise.all([
    admin.from('supplier_invoices').select('supplier_id, currency, amount').is('deleted_at', null),
    admin.from('supplier_payments').select('supplier_id, currency, amount').is('deleted_at', null),
  ]);
  type Money = { supplier_id: string; currency: 'USD' | 'TL' | 'EUR'; amount: number };
  const groupBySupplier = (rows: Money[]) => {
    const m = new Map<string, Money[]>();
    for (const r of rows) {
      const list = m.get(r.supplier_id);
      if (list) list.push(r); else m.set(r.supplier_id, [r]);
    }
    return m;
  };
  const invBy = groupBySupplier((inv.data ?? []) as Money[]);
  const payBy = groupBySupplier((pay.data ?? []) as Money[]);

  const withTotals = (suppliers ?? []).map((s: { id: string }) => ({
    ...s,
    totals: computeTotals(invBy.get(s.id) ?? [], payBy.get(s.id) ?? []) as CurrencyTotals,
  }));

  return NextResponse.json({ suppliers: withTotals });
}

export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireRole([...SUPPLIER_WRITE_ROLES]);
  if (deny) return deny;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });

  let base = String(body.code ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!base) base = suggestVendorCode(name);
  const { data: existing } = await admin.from('suppliers').select('code');
  const taken = new Set((existing ?? []).map((s: { code: string | null }) => (s.code ?? '').toUpperCase()));
  let finalCode = base;
  if (taken.has(finalCode)) { let n = 2; while (taken.has(`${base}${n}`)) n++; finalCode = `${base}${n}`; }

  const insert = {
    name, code: finalCode, is_active: true,
    country: String(body.country ?? 'TR') || 'TR',
    email: str(body.email), phone: str(body.phone), address: str(body.address),
    tax_office: str(body.tax_office), tax_number: str(body.tax_number),
    payment_terms: str(body.payment_terms), notes: str(body.notes),
  };
  const { data, error } = await admin.from('suppliers').insert(insert).select(PROFILE_COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'supplier.created', resource: `${data.code} — ${data.name}` });
  return NextResponse.json({ supplier: data });
}

function str(v: unknown): string | null { const s = String(v ?? '').trim(); return s || null; }
