import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_SEE_ALL_ROLES } from '@/lib/marketing/roles';
import { buildMyDay } from '@/lib/dashboard/myDay';
import { buildTeamGaps } from '@/lib/marketing/teamGaps';
import { MarketingWorkspaceClient } from '@/components/platform/marketing/MarketingWorkspaceClient';
import type { UserRole } from '@/types/database';

// Per-user actionable data (My Day sections below) — never serve a cached render.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Redesigned 2026-09-16: this used to be an engineering status page (Phase/migration
// progress notes) — useful while building the module, meaningless to an actual Marketing
// user asking "who do I need to talk to today, what do I need to do." Now it leads with
// buildMyDay() (lib/dashboard/myDay.ts — the same real, already-live data the /dashboard
// "My Day" widget uses) so the system tells the user what needs doing, instead of the
// user having to go find it.
export default async function MarketingWorkspacePage() {
  await requirePage('page.marketing');
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase.from('profiles').select('role, full_name').eq('id', user!.id).single();
  const profile = profileData as { role: UserRole; full_name: string | null } | null;
  const role = profile?.role ?? 'marketing_pr';
  const isManager = MARKETING_SEE_ALL_ROLES.includes(role);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const [prospectRes, opportunityRes, potentialRes, myDay, teamGaps] = await Promise.all([
    sb.from('prospects').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('is_archived', false),
    sb.from('opportunities').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    sb.from('prospect_potentials').select('id', { count: 'exact', head: true }).is('deleted_at', null)
      .not('status', 'in', '(converted,lost,cancelled)'),
    buildMyDay(admin, user!.id, role),
    // Managers don't personally own Leads/Potentials, so "assigned to me" (myDay above) is
    // always empty for them even when the team has real, unaddressed work — this is the
    // team-wide counterpart (see lib/marketing/teamGaps.ts).
    isManager ? buildTeamGaps(admin) : Promise.resolve([]),
  ]);

  return (
    <div className="main-inner">
      <MarketingWorkspaceClient
        role={role}
        fullName={profile?.full_name ?? null}
        isManager={isManager}
        prospectCount={prospectRes.error ? null : (prospectRes.count ?? 0)}
        opportunityCount={opportunityRes.error ? null : (opportunityRes.count ?? 0)}
        potentialCount={potentialRes.error ? null : (potentialRes.count ?? 0)}
        myDaySections={myDay.sections}
        teamGapSections={teamGaps}
      />
    </div>
  );
}
