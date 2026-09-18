import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_SEE_ALL_ROLES } from '@/lib/marketing/roles';
import { buildMyDay } from '@/lib/dashboard/myDay';
import { buildTeamGaps } from '@/lib/marketing/teamGaps';
import { enrichProspectRows, type ProspectListBase } from '@/lib/marketing/prospectRows';
import { getAssignedRegions } from '@/lib/access/regionScope';
import { fetchInChunks } from '@/lib/supabase/chunkedIn';
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

  // 🔴 2026-09-18: used to be scoped to Contacts this person personally owns/created/is
  // assigned to — direct correction: "ekledeklerinden sorumlu olayı yanlış, sistemde kaç
  // contact varsa onlardan sorumlu" (being responsible only for what you personally added is
  // wrong — you're responsible for every Contact visible to you in the system). Now scoped
  // the same way the real Contacts page itself decides visibility for a marketing_pr:
  // region-assigned ones see their region (or an unset region, migration 112), everyone else
  // (including managers) sees all of them. No $ amounts anywhere (marketing_pr never sees
  // pricing/value figures) — just percentages.
  // 🔴 PostgREST caps any row-returning select at 1000 regardless of how many rows actually
  // match — bit this exact module more than once already this session (1758 Contacts showing
  // as 1000). Page through with .range() until a short page confirms there's nothing left.
  const assignedRegions = isManager ? [] : await getAssignedRegions(admin, user!.id);
  const myProspectCols = 'id, owner_id, assigned_marketing_user_id, organization_name, person_name, main_email, main_phone, '
    + 'website, source_label, source_raw_label, source_detail, business_types, x_note, region, status';
  const myProspectsRaw: unknown[] = [];
  for (let offset = 0; offset < 20000; offset += 1000) {
    let pageQuery = admin.from('prospects').select(myProspectCols)
      .is('deleted_at', null).eq('is_archived', false)
      // `.not('external_ref','like',…)` alone silently drops every Contact with a NULL
      // external_ref too (SQL's NOT (NULL LIKE 'x%') is NULL, not TRUE) — see the same bug
      // fixed in app/api/marketing/prospects/route.ts and its page.tsx counterpart.
      .or('external_ref.is.null,external_ref.not.like.opportunity-fallback:%');
    if (assignedRegions.length > 0) {
      pageQuery = pageQuery.or(`regions.ov.{${assignedRegions.join(',')}},regions.eq.{}`);
    }
    const { data: page } = await pageQuery.range(offset, offset + 999);
    myProspectsRaw.push(...(page ?? []));
    if (!page || page.length < 1000) break;
  }
  const myProspectsEnriched = await enrichProspectRows(admin, myProspectsRaw as unknown as ProspectListBase[]);
  const contactsTotal = myProspectsEnriched.length;

  // 🔴 2026-09-18: top dashboard cards redefined per direct spec — "tamamlanmayan contactlar
  // kaç contact ise onun yüzdesi, unqualified client sayısı, contract imzası yüzdesi (Sales
  // CRM'den), biten projeler (soon)". Same completeness_percent < 100 threshold the Contacts
  // page's own "missing info" filter already uses, for consistency across the app.
  const incompleteCount = myProspectsEnriched.filter(p => p.completeness_percent < 100).length;

  // "Unqualified" = every Need on this Contact was disqualified — prospects.status already
  // rolls this up (lib/marketing/opportunityEngine.ts's rollupProspectStatus), so it's a
  // direct count, not a fresh computation. A plain count, not a percentage — "sayısı".
  const unqualifiedCount = (myProspectsRaw as { status?: string }[]).filter(p => p.status === 'disqualified').length;

  // Contract signed = this Contact produced a real Sales project with a closed_deal_date
  // (the actual "contract signed" field on `projects`, set once Sales closes the deal) —
  // confirmed denominator: all visible Contacts, not just the ones with an Opportunity.
  const visibleProspectIds = myProspectsEnriched.map(p => p.id);
  const oppRows = await fetchInChunks(
    visibleProspectIds,
    chunk => admin.from('opportunities').select('prospect_id, project_id').in('prospect_id', chunk).not('project_id', 'is', null),
  ) as { prospect_id: string; project_id: string }[];
  const projectIds = [...new Set(oppRows.map(o => o.project_id))];
  const closedProjectIds = new Set(
    (await fetchInChunks(
      projectIds,
      chunk => admin.from('projects').select('id, closed_deal_date').in('id', chunk).not('closed_deal_date', 'is', null),
    ) as { id: string; closed_deal_date: string }[]).map(p => p.id),
  );
  const contractSignedCount = new Set(oppRows.filter(o => closedProjectIds.has(o.project_id)).map(o => o.prospect_id)).size;

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { count: weeklyActivityCount } = await admin.from('audit_log')
    .select('id', { count: 'exact', head: true }).eq('actor_id', user!.id).gte('created_at', weekAgo);

  const [prospectRes, potentialRes, myDay, teamGaps] = await Promise.all([
    sb.from('prospects').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('is_archived', false)
      .or('external_ref.is.null,external_ref.not.like.opportunity-fallback:%'),
    sb.from('prospect_potentials').select('id', { count: 'exact', head: true }).is('deleted_at', null)
      .not('status', 'in', '(converted,lost,cancelled)'),
    buildMyDay(admin, user!.id, role),
    // 🔴 2026-09-17: used to be manager-only ("Managers don't personally own Leads/
    // Potentials, so myDay above is always empty for them") — reversed per direct
    // instruction: a marketing_pr's task list should be GENERATED from real, team-wide data
    // gaps too (missing Contact info, Potentials nobody's followed up on, missing region,
    // anniversaries, upcoming events) — not just whatever happens to be "assigned to them",
    // which turned out to be an unreliable signal this session (see the assignee-clearing
    // fixes a few commits back). Everyone gets the same team-wide list now.
    buildTeamGaps(admin),
  ]);

  const teamGapSections = teamGaps;

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
        myStats={{
          contactsTotal, incompleteCount, unqualifiedCount, contractSignedCount,
          weeklyActivityCount: weeklyActivityCount ?? 0,
        }}
      />
    </div>
  );
}
