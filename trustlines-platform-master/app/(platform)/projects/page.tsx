import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ProjectsTableClient } from '@/components/platform/projects/ProjectsTableClient';
import type { UserRole } from '@/types/database';

export default async function ProjectsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'ops_manager';

  const { data: rows, error: rowsError } = await supabase
    .from('projects')
    .select('id, code, name, current_stage, categories, deal_value, currency, margin_target_pct, est_delivery_date, client_id, trustlines_pm_id')
    .neq('is_archived', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (rowsError) console.error('[projects] query error:', rowsError);

  const projectList = (rows ?? []) as {
    id: string; code: string; name: string; current_stage: string;
    categories: string[]; deal_value: number | null; currency: string;
    margin_target_pct: number | null; est_delivery_date: string | null;
    client_id: string | null; trustlines_pm_id: string | null;
  }[];

  const clientIds = [...new Set(projectList.map(p => p.client_id).filter(Boolean))] as string[];
  const pmIds     = [...new Set(projectList.map(p => p.trustlines_pm_id).filter(Boolean))] as string[];

  const [clientsRes, profilesRes] = await Promise.all([
    clientIds.length > 0
      ? supabase.from('clients').select('id, name').in('id', clientIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    pmIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', pmIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const clientMap = new Map((clientsRes.data ?? []).map(c => [c.id, c]));
  const ownerMap  = new Map((profilesRes.data ?? []).map(p => [p.id, p]));

  const projects: ProjectRow[] = projectList.map(r => ({
    id:               r.id,
    code:             r.code,
    name:             r.name,
    current_stage:    r.current_stage,
    categories:       r.categories,
    deal_value:       r.deal_value,
    currency:         r.currency,
    margin_target_pct: r.margin_target_pct,
    est_delivery_date: r.est_delivery_date,
    client: r.client_id ? (clientMap.get(r.client_id) ?? null) : null,
    owner:  r.trustlines_pm_id ? (ownerMap.get(r.trustlines_pm_id) ?? null) : null,
  }));

  const today = new Date().toISOString().split('T')[0];
  const activeCount  = projects.filter(p => p.current_stage !== 'delivered').length;
  const overdueCount = projects.filter(
    p => p.est_delivery_date && p.est_delivery_date < today && p.current_stage !== 'delivered',
  ).length;

  return (
    <div className="main-inner">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-default)', margin: '0 0 4px' }}>
            Projects
          </h1>
          <p className="page-head-sub">
            {activeCount} active
            {overdueCount > 0 && (
              <span style={{ color: 'var(--status-danger)', marginLeft: 6 }}>
                · {overdueCount} overdue
              </span>
            )}
          </p>
        </div>
        {(userRole === 'ops_manager' || userRole === 'general_manager') && (
          <Link href="/projects/new" className="btn btn-primary">
            + New project
          </Link>
        )}
      </div>

      <ProjectsTableClient projects={projects} userRole={userRole} today={today} />
    </div>
  );
}

export interface ProjectRow {
  id: string;
  code: string;
  name: string;
  current_stage: string;
  categories: string[];
  deal_value: number | null;
  currency: string;
  margin_target_pct: number | null;
  est_delivery_date: string | null;
  client: { name: string } | null;
  owner: { full_name: string } | null;
}
