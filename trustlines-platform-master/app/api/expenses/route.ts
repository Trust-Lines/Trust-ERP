import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { EXPENSE_READ_ROLES, EXPENSE_WRITE_ROLES, EXPENSE_CATEGORIES, CURRENCIES, computeExpenseTotals } from '@/lib/expenses/config';

export const dynamic = 'force-dynamic';
const COLS = 'id, category, description, currency, amount, expense_date, project_id, supplier_id, is_paid, dropbox_path, created_at';

export async function GET() {
  const { admin, deny } = await requireRole([...EXPENSE_READ_ROLES]);
  if (deny) return deny;

  const { data, error } = await admin.from('trust_expenses')
    .select(COLS).is('deleted_at', null).order('expense_date', { ascending: false, nullsFirst: false });
  if (error) return NextResponse.json({ expenses: [], totals: computeExpenseTotals([]), schemaError: error.message });

  return NextResponse.json({ expenses: data ?? [], totals: computeExpenseTotals(data ?? []) });
}

export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireRole([...EXPENSE_WRITE_ROLES]);
  if (deny) return deny;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'A positive amount is required' }, { status: 400 });
  const currency = String(body.currency ?? 'USD');
  if (!CURRENCIES.includes(currency as (typeof CURRENCIES)[number])) return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
  const category = String(body.category ?? 'other');
  if (!EXPENSE_CATEGORIES.includes(category as (typeof EXPENSE_CATEGORIES)[number])) return NextResponse.json({ error: 'Invalid category' }, { status: 400 });

  const insert = {
    category, currency, amount,
    description: str(body.description),
    expense_date: str(body.expense_date),
    project_id: str(body.project_id),
    supplier_id: str(body.supplier_id),
    is_paid: body.is_paid === true,
    dropbox_path: str(body.dropbox_path),
    created_by: user.id,
  };
  const { data, error } = await admin.from('trust_expenses').insert(insert).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'expense.created', projectId: insert.project_id ?? undefined, resource: `expense:${data.id}`, newValue: { category, amount, currency } });
  return NextResponse.json({ expense: data });
}

function str(v: unknown): string | null { const s = String(v ?? '').trim(); return s || null; }
