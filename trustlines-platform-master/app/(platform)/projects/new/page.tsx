import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NewProjectForm } from '@/components/platform/projects/NewProjectForm';
import type { UserRole } from '@/types/database';

export default async function NewProjectPage() {
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

  const [clientsRes, tlinesPmRes, trustlinesPmRes, qcRes, franchisesRes, companiesRes] = await Promise.all([
    supabase.from('clients').select('id, name, code').eq('is_active', true).order('name'),
    supabase.from('profiles').select('id, full_name, pm_client_id, is_pm_supervisor').eq('role', 'tlines_pm').eq('is_active', true),
    supabase.from('profiles').select('id, full_name').eq('role', 'trustlines_pm').eq('is_active', true),
    supabase.from('profiles').select('id, full_name').eq('role', 'qc_responsible').eq('is_active', true),

    adm.from('client_franchises').select('id, name, code, client_id').neq('is_active', false).order('name'),
    adm.from('client_companies').select('id, name, code, client_id').neq('is_active', false).order('name'),
  ]);

  return (
    <div className="main-inner">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link href="/projects" className="btn btn-ghost btn-sm" style={{ color: 'var(--fg-subtle)' }}>
          ← Back
        </Link>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-default)', margin: 0 }}>
          New project
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
      />
    </div>
  );
}
