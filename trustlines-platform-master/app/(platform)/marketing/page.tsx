import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_SEE_ALL_ROLES } from '@/lib/marketing/roles';
import { buildMyDay } from '@/lib/dashboard/myDay';
import { buildTeamGaps, buildTeamAnniversaries } from '@/lib/marketing/teamGaps';
import { enrichProspectRows, type ProspectListBase } from '@/lib/marketing/prospectRows';
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

  // 🔴 2026-09-17: personal "how am I doing" stats — no $ amounts anywhere (marketing_pr
  // never sees pricing/value figures), just completion percentages computed from Contacts
  // this person owns/is assigned. Scoped to just their own rows, so this stays cheap.
  const myProspectCols = 'id, owner_id, assigned_marketing_user_id, organization_name, person_name, main_email, main_phone, '
    + 'website, source_label, source_raw_label, source_detail, business_types, x_note';
  const { data: myProspectsRaw } = await admin.from('prospects').select(myProspectCols)
    .is('deleted_at', null).eq('is_archived', false)
    .not('external_ref', 'like', 'opportunity-fallback:%')
    .or(`owner_id.eq.${user!.id},assigned_marketing_user_id.eq.${user!.id}`);
  const myProspectsEnriched = await enrichProspectRows(admin, (myProspectsRaw ?? []) as unknown as ProspectListBase[]);
  const contactsComplete = myProspectsEnriched.filter(p => p.completeness_percent >= 80).length;
  const contactsTotal = myProspectsEnriched.length;

  const today = new Date().toISOString().slice(0, 10);
  const { data: myPotentials } = await admin.from('prospect_potentials')
    .select('id, target_contact_date').is('deleted_at', null)
    .not('status', 'in', '(converted,lost,cancelled)').eq('assigned_to', user!.id);
  const potentialsList = (myPotentials ?? []) as { id: string; target_contact_date: string | null }[];
  const potentialsOnTime = potentialsList.filter(p => !p.target_contact_date || p.target_contact_date >= today).length;
  const potentialsTotal = potentialsList.length;

  const [prospectRes, potentialRes, myDay, teamGaps, myAnniversaries] = await Promise.all([
    sb.from('prospects').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('is_archived', false)
      .not('external_ref', 'like', 'opportunity-fallback:%'),
    sb.from('prospect_potentials').select('id', { count: 'exact', head: true }).is('deleted_at', null)
      .not('status', 'in', '(converted,lost,cancelled)'),
    buildMyDay(admin, user!.id, role),
    // Managers don't personally own Leads/Potentials, so "assigned to me" (myDay above) is
    // always empty for them even when the team has real, unaddressed work — this is the
    // team-wide counterpart (see lib/marketing/teamGaps.ts). Includes team anniversaries.
    isManager ? buildTeamGaps(admin) : Promise.resolve([]),
    // Non-managers still get anniversaries (a team-wide thing, not manager-exclusive) —
    // buildTeamGaps already covers it for managers above, so this only runs otherwise.
    isManager ? Promise.resolve(null) : buildTeamAnniversaries(admin),
  ]);

  const teamGapSections = myAnniversaries && myAnniversaries.items.length > 0
    ? [myAnniversaries, ...teamGaps]
    : teamGaps;

  return (
    <div style={{ padding: '24px 32px' }}>
      <MarketingWorkspaceClient
        role={role}
        fullName={profile?.full_name ?? null}
        isManager={isManager}
        prospectCount={prospectRes.error ? null : (prospectRes.count ?? 0)}
        potentialCount={potentialRes.error ? null : (potentialRes.count ?? 0)}
        myDaySections={myDay.sections}
        teamGapSections={teamGapSections}
        myStats={{ contactsComplete, contactsTotal, potentialsOnTime, potentialsTotal }}
      />
    </div>
  );
}
