import { redirect } from 'next/navigation';
import { requirePage } from '@/lib/permissions/requirePage';
import { createClient, getVerifiedUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRolePermissions } from '@/lib/permissions/server';
import { pageAllowed } from '@/lib/permissions/catalog';
import { WorkspaceDashboard, type DashProject, type DesignDoc } from '@/components/platform/myWorkspace/WorkspaceDashboard';

// My Workspace → Overview (Figma "General Manager_Dashboard", node 714:35213). The page reads the
// person's name/role and — through the person's own RLS client, so every role sees only its own
// scope — the projects and the newest design documents. The rest (tasks, approvals, containers,
// installations, key-client deals) the dashboard fetches from the endpoints those pages use.
const PROJECT_COLS = 'id, code, name, region, current_stage, categories, site_location, created_at, closed_deal_date, est_production_start';
const DESIGN_TYPES = ['sales_design', 'plan_layout', 'construction_drawings', 'shop_drawing'];

export default async function WorkspaceOverviewPage() {
  await requirePage('page.my_workspace');
  const user = await getVerifiedUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = (await createClient()) as any;
  const { data: profile } = await sb.from('profiles').select('full_name, role').eq('id', user.id).single();
  const role = (profile as { role?: string } | null)?.role ?? null;
  const perms = await getRolePermissions(createAdminClient(), role);
  const can = (key: string) => !!role && pageAllowed(role, perms, key);
  const canProjects = can('page.projects');

  const [projects, docs] = canProjects ? await Promise.all([
    sb.from('projects').select(PROJECT_COLS).eq('is_archived', false).eq('is_draft', false)
      .order('created_at', { ascending: false }).limit(1000),
    sb.from('documents').select('id, project_id, file_name, file_size_bytes, created_at')
      .in('doc_type', DESIGN_TYPES).order('created_at', { ascending: false }).limit(3),
  ]) : [{ data: [], error: null }, { data: [], error: null }];

  return (
    <WorkspaceDashboard
      userName={(profile as { full_name?: string } | null)?.full_name || user.email || 'there'}
      role={role ?? ''}
      projects={projects.error ? null : (projects.data ?? []) as DashProject[]}
      designDocs={docs.error ? null : (docs.data ?? []) as DesignDoc[]}
      access={{
        projects: canProjects,
        production: can('page.production'),
        installation: can('page.installation'),
        logistics: can('page.logistics'),
        opportunities: can('page.tlines_dashboard'),
      }}
    />
  );
}
