import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { PROJECT_FINANCE_READ_ROLES, buildProjectFinance } from '@/lib/finance/projectTotals';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { admin, deny } = await requireRole([...PROJECT_FINANCE_READ_ROLES]);
  if (deny) return deny;

  const [piRes, invRes, payRes, expRes] = await Promise.all([
    admin.from('production_items')
      .select('pf_usd, pf_tl, invoice, invoice_tl, expenses_usd, expenses_tl')
      .eq('project_id', id).is('deleted_at', null),
    admin.from('supplier_invoices').select('currency, amount').eq('project_id', id).is('deleted_at', null),
    admin.from('supplier_payments').select('currency, amount').eq('project_id', id).is('deleted_at', null),
    admin.from('trust_expenses').select('currency, amount').eq('project_id', id).is('deleted_at', null),
  ]);

  const finance = buildProjectFinance(
    piRes.data ?? [],
    invRes.error ? [] : (invRes.data ?? []),
    payRes.error ? [] : (payRes.data ?? []),
    expRes.error ? [] : (expRes.data ?? []),
  );

  return NextResponse.json({ finance });
}
