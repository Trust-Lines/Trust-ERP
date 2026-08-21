import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NewProjectForm, type EditProjectData } from '@/components/platform/projects/NewProjectForm';
import type { UserRole } from '@/types/database';

function toDateInput(v: unknown): string {
  if (!v) return '';
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'ops_manager';

  if (userRole !== 'ops_manager' && userRole !== 'general_manager') redirect('/projects');

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = admin as any;

  const [projectRes, clientsRes, tlinesPmRes, trustlinesPmRes, qcRes, franchisesRes, companiesRes] = await Promise.all([
    adm.from('projects').select('*').eq('id', id).is('deleted_at', null).single(),
    supabase.from('clients').select('id, name, code').eq('is_active', true).order('name'),
    supabase.from('profiles').select('id, full_name, pm_client_id, is_pm_supervisor').eq('role', 'tlines_pm').eq('is_active', true),
    supabase.from('profiles').select('id, full_name').eq('role', 'trustlines_pm').eq('is_active', true),
    supabase.from('profiles').select('id, full_name').eq('role', 'qc_responsible').eq('is_active', true),
    adm.from('client_franchises').select('id, name, code, client_id').neq('is_active', false).order('name'),
    adm.from('client_companies').select('id, name, code, client_id').neq('is_active', false).order('name'),
  ]);

  const p = projectRes.data as Record<string, unknown> | null;
  if (!p) notFound();

  const editProject: EditProjectData = {
    id:                String(p.id),
    name:              (p.name as string) ?? '',
    project_code:      (p.code as string) ?? '',
    client_id:         (p.client_id as string) ?? '',
    client_company_id: (p.client_company_id as string | null) ?? null,
    site_location:     (p.site_location as string) ?? '',
    closed_deal_date:  toDateInput(p.closed_deal_date),
    est_delivery_date: toDateInput(p.est_delivery_date),
    categories:        (p.categories as string[] | null) ?? [],
    category_values:   (p.category_values as Record<string, number> | null) ?? null,
    deal_value:        (p.deal_value as number | null) ?? null,
    currency:          ((p.currency as string) ?? 'USD') as 'USD' | 'EUR' | 'TRY',
    clickup_task_id:   (p.clickup_task_id as string | null) ?? null,
    quickbooks_ref:    (p.quickbooks_ref as string | null) ?? null,
    tlines_pm_id:      (p.tlines_pm_id as string | null) ?? null,
    trustlines_pm_id:  (p.trustlines_pm_id as string | null) ?? null,
    dropbox_root_path: (p.dropbox_root_path as string | null) ?? null,
  };

  return (
    <div className="main-inner">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link href={`/projects/${id}`} className="btn btn-ghost btn-sm" style={{ color: 'var(--fg-subtle)' }}>
          ← Back
        </Link>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-default)', margin: 0 }}>
          Edit project
        </h1>
      </div>

      <NewProjectForm
        currentUserId={user.id}
        clients={(clientsRes.data ?? []) as { id: string; name: string; code: string | null }[]}
        tlinesPmProfiles={(tlinesPmRes.data ?? []) as { id: string; full_name: string; pm_client_id?: string | null; is_pm_supervisor?: boolean }[]}
        trustlinesPmProfiles={(trustlinesPmRes.data ?? []) as { id: string; full_name: string }[]}
        qcProfiles={(qcRes.data ?? []) as { id: string; full_name: string }[]}
        allFranchises={(franchisesRes.data ?? []) as { id: string; name: string; code: string | null; client_id: string }[]}
        allCompanies={(companiesRes.data ?? []) as { id: string; name: string; code: string | null; client_id: string | null }[]}
        editProject={editProject}
      />
    </div>
  );
}
