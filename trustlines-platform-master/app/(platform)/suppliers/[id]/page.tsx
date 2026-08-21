import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { SupplierDetailClient } from '@/components/platform/suppliers/SupplierDetailClient';
import { SUPPLIER_WRITE_ROLES, computeTotals } from '@/lib/suppliers/config';
import type { UserRole } from '@/types/database';

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('page.suppliers');
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const role = (profile as { role: UserRole } | null)?.role ?? 'ops_manager';
  const canEdit = (SUPPLIER_WRITE_ROLES as readonly string[]).includes(role);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: supplier } = await admin.from('suppliers')
    .select('id, code, name, country, is_active, email, phone, address, tax_office, tax_number, payment_terms, notes, created_at')
    .eq('id', id).maybeSingle();
  if (!supplier) notFound();

  const [invRes, payRes] = await Promise.all([
    admin.from('supplier_invoices')
      .select('id, supplier_id, project_id, invoice_number, invoice_date, currency, amount, description, dropbox_path, status, created_at')
      .eq('supplier_id', id).is('deleted_at', null).order('invoice_date', { ascending: false, nullsFirst: false }),
    admin.from('supplier_payments')
      .select('id, supplier_id, invoice_id, project_id, currency, amount, paid_at, method, reference, notes, created_at')
      .eq('supplier_id', id).is('deleted_at', null).order('paid_at', { ascending: false, nullsFirst: false }),
  ]);
  const invoices = invRes.data ?? [];
  const payments = payRes.data ?? [];
  const totals = computeTotals(invoices, payments);

  const projectIds = Array.from(new Set([...invoices, ...payments].map(r => r.project_id).filter(Boolean)));
  let projects: { id: string; code: string; name: string }[] = [];
  if (projectIds.length) {
    const pr = await admin.from('projects').select('id, code, name').in('id', projectIds);
    projects = pr.data ?? [];
  }

  return (
    <div className="main-inner">
      <SupplierDetailClient
        supplier={supplier} initialInvoices={invoices} initialPayments={payments}
        totals={totals} projects={projects} canEdit={canEdit}
      />
    </div>
  );
}
