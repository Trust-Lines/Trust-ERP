import { createClient } from '@/lib/supabase/server';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_SEE_ALL_ROLES } from '@/lib/marketing/roles';
import { MarketingWorkspaceClient } from '@/components/platform/marketing/MarketingWorkspaceClient';
import type { UserRole } from '@/types/database';

// This page used to be `redirect('/marketing/opportunities')` — a dead end that never actually
// rendered MarketingWorkspaceClient (the real Marketing landing page), which sat completely
// unused in the codebase. "Marketing Home" in the sidebar pointed here and looked broken because
// of it. Wired for real now: requirePage() is the fail-closed gate (AGENTS.md §3), everything else
// reads through the RLS-scoped client so marketing_pr only ever sees counts for their own records.
export default async function MarketingWorkspacePage() {
  await requirePage('page.marketing');
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const role = (profileData as { role: UserRole } | null)?.role ?? 'marketing_pr';
  const isManager = MARKETING_SEE_ALL_ROLES.includes(role);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [prospectRes, opportunityRes, potentialRes, migrationProbe] = await Promise.all([
    sb.from('prospects').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('is_archived', false),
    sb.from('opportunities').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    sb.from('prospect_potentials').select('id', { count: 'exact', head: true }).is('deleted_at', null)
      .not('status', 'in', '(converted,lost,cancelled)'),
    sb.from('opportunities').select('project_id').limit(1),
  ]);

  return (
    <div className="main-inner">
      <MarketingWorkspaceClient
        role={role}
        isManager={isManager}
        prospectCount={prospectRes.error ? null : (prospectRes.count ?? 0)}
        opportunityCount={opportunityRes.error ? null : (opportunityRes.count ?? 0)}
        potentialCount={potentialRes.error ? null : (potentialRes.count ?? 0)}
        migration078Applied={!migrationProbe.error}
      />
    </div>
  );
}
