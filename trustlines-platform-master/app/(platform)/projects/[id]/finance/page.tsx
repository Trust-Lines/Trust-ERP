import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProjectFinanceClient } from '@/components/platform/projects/ProjectFinanceClient';
import { PROJECT_FINANCE_READ_ROLES, buildProjectFinance } from '@/lib/finance/projectTotals';
import type { UserRole } from '@/types/database';

export default async function ProjectFinancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: UserRole } | null)?.role ?? '';
  if (!(PROJECT_FINANCE_READ_ROLES as readonly string[]).includes(role)) redirect('/projects');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: project } = await admin.from('projects').select('id, code, name, tlines_pm_id').eq('id', id).maybeSingle();
  if (!project) notFound();
  if (role === 'tlines_pm' && project.tlines_pm_id !== user.id) redirect('/projects');

  const [piRes, invRes, payRes, expRes] = await Promise.all([
    admin.from('production_items').select('pf_usd, pf_tl, invoice, invoice_tl, expenses_usd, expenses_tl').eq('project_id', id).is('deleted_at', null),
    admin.from('supplier_invoices').select('id, supplier_id, invoice_number, invoice_date, currency, amount, status').eq('project_id', id).is('deleted_at', null).order('invoice_date', { ascending: false, nullsFirst: false }),
    admin.from('supplier_payments').select('id, supplier_id, currency, amount, paid_at, method').eq('project_id', id).is('deleted_at', null).order('paid_at', { ascending: false, nullsFirst: false }),
    admin.from('trust_expenses').select('id, category, currency, amount, expense_date, is_paid, description').eq('project_id', id).is('deleted_at', null).order('expense_date', { ascending: false, nullsFirst: false }),
  ]);

  const invoices = invRes.error ? [] : (invRes.data ?? []);
  const payments = payRes.error ? [] : (payRes.data ?? []);
  const expenses = expRes.error ? [] : (expRes.data ?? []);
  const finance = buildProjectFinance(piRes.data ?? [], invoices, payments, expenses);

  const crRes = await admin.from('change_requests')
    .select('id, title, status, budget_impact, currency, timeline_impact_days, resolved_at')
    .eq('project_id', id).in('status', ['approved', 'implemented']).is('deleted_at', null)
    .order('resolved_at', { ascending: false, nullsFirst: false }).limit(100);
  const approvedCRs = crRes.error ? [] : (crRes.data ?? []);

  const supplierIds = Array.from(new Set([...invoices, ...payments].map(r => r.supplier_id).filter(Boolean)));
  let suppliers: { id: string; code: string | null; name: string }[] = [];
  if (supplierIds.length) {
    const sr = await admin.from('suppliers').select('id, code, name').in('id', supplierIds);
    suppliers = sr.data ?? [];
  }

  return (
    <div className="main-inner">
      <ProjectFinanceClient
        projectId={id} projectCode={project.code} projectName={project.name}
        finance={finance} invoices={invoices} payments={payments} expenses={expenses} suppliers={suppliers}
        approvedCRs={approvedCRs}
      />
    </div>
  );
}
