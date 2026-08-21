import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { EXPENSE_WRITE_ROLES, EXPENSE_CATEGORIES, CURRENCIES } from '@/lib/expenses/config';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ id: string }> };
const COLS = 'id, category, description, currency, amount, expense_date, project_id, supplier_id, is_paid, dropbox_path, created_at';
const EDITABLE = ['category', 'description', 'currency', 'amount', 'expense_date', 'project_id', 'supplier_id', 'is_paid', 'dropbox_path'] as const;

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole([...EXPENSE_WRITE_ROLES]);
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
    } else if (k === 'category') {
      if (!EXPENSE_CATEGORIES.includes(String(body[k]) as (typeof EXPENSE_CATEGORIES)[number])) return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      patch[k] = body[k];
    } else if (k === 'is_paid') {
      patch[k] = body[k] === true;
    } else {
      const v = String(body[k] ?? '').trim(); patch[k] = v || null;
    }
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('trust_expenses').update(patch).eq('id', id).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'expense.updated', resource: `expense:${id}`, newValue: Object.keys(patch) });
  return NextResponse.json({ expense: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole([...EXPENSE_WRITE_ROLES]);
  if (deny) return deny;

  const { error } = await admin.from('trust_expenses').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'expense.deleted', resource: `expense:${id}` });
  return NextResponse.json({ ok: true });
}
