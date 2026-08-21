import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { ExpensesClient } from '@/components/platform/expenses/ExpensesClient';
import { EXPENSE_WRITE_ROLES, computeExpenseTotals } from '@/lib/expenses/config';
import type { UserRole } from '@/types/database';

export default async function ExpensesPage() {
  await requirePage('page.expenses');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const role = (profile as { role: UserRole } | null)?.role ?? 'ops_manager';
  const canEdit = (EXPENSE_WRITE_ROLES as readonly string[]).includes(role);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const res = await admin.from('trust_expenses')
    .select('id, category, description, currency, amount, expense_date, project_id, supplier_id, is_paid, dropbox_path, created_at')
    .is('deleted_at', null).order('expense_date', { ascending: false, nullsFirst: false });
  const schemaError: string | null = res.error ? `Trust Expenses table is not ready (${res.error.message}). Run migration 061_trust_expenses.sql.` : null;
  const expenses = res.error ? [] : (res.data ?? []);

  const [projRes, supRes] = await Promise.all([
    admin.from('projects').select('id, code, name').is('deleted_at', null)
      .or('is_archived.is.null,is_archived.eq.false')
      .or('is_draft.is.null,is_draft.eq.false,delivered_to_trust_at.not.is.null')
      .order('code', { ascending: true }),
    admin.from('suppliers').select('id, code, name').eq('is_active', true).order('name', { ascending: true }),
  ]);

  return (
    <div className="main-inner">
      <ExpensesClient
        initialExpenses={expenses} totals={computeExpenseTotals(expenses)} canEdit={canEdit}
        projects={projRes.data ?? []} suppliers={supRes.data ?? []} schemaError={schemaError}
      />
    </div>
  );
}
