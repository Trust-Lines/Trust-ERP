import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { SuppliersClient } from '@/components/platform/suppliers/SuppliersClient';
import { SUPPLIER_WRITE_ROLES, computeTotals } from '@/lib/suppliers/config';
import type { UserRole } from '@/types/database';

export default async function SuppliersPage() {
  await requirePage('page.suppliers');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const role = (profile as { role: UserRole } | null)?.role ?? 'ops_manager';
  const canEdit = (SUPPLIER_WRITE_ROLES as readonly string[]).includes(role);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const sRes = await admin.from('suppliers')
    .select('id, code, name, country, is_active, email, phone, created_at')
    .order('name', { ascending: true });
  const schemaError: string | null = sRes.error ? `Supplier finance tables are not ready (${sRes.error.message}). Run migration 060_supplier_finance.sql.` : null;
  const suppliers = sRes.error ? [] : (sRes.data ?? []);

  const [invRes, payRes] = await Promise.all([
    admin.from('supplier_invoices').select('supplier_id, currency, amount').is('deleted_at', null),
    admin.from('supplier_payments').select('supplier_id, currency, amount').is('deleted_at', null),
  ]);
  type Money = { supplier_id: string; currency: 'USD' | 'TL' | 'EUR'; amount: number };
  const group = (rows: Money[]) => {
    const m = new Map<string, Money[]>();
    for (const r of rows) { const l = m.get(r.supplier_id); if (l) l.push(r); else m.set(r.supplier_id, [r]); }
    return m;
  };
  const invBy = group((invRes.data ?? []) as Money[]);
  const payBy = group((payRes.data ?? []) as Money[]);
  const withTotals = suppliers.map((s: { id: string }) => ({
    ...s, totals: computeTotals(invBy.get(s.id) ?? [], payBy.get(s.id) ?? []),
  }));

  return (
    <div className="main-inner">
      <SuppliersClient initialSuppliers={withTotals} canEdit={canEdit} schemaError={schemaError} />
    </div>
  );
}
