import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_SEE_ALL_ROLES } from '@/lib/marketing/roles';
import { buildMyDay } from '@/lib/dashboard/myDay';
import { buildTeamGaps } from '@/lib/marketing/teamGaps';
import { enrichProspectRows, type ProspectListBase } from '@/lib/marketing/prospectRows';
import { getAssignedRegions } from '@/lib/access/regionScope';
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
    + 'website, source_label, source_raw_label, source_detail, business_types, x_note, region';
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
  // 🔴 2026-09-18: was a count of contacts clearing an 80% threshold — on a small/real list
  // where every Contact sits at a real, different, sub-80% completeness (30-70%, genuine
  // gradual progress, not neglect), that rendered as a flat 0%, hiding the progress entirely
  // and making the tile look broken ("100 var ya 100'de 0" — direct report). Average
  // completeness instead — reflects partial progress instead of an all-or-nothing bar.
  const contactsTotal = myProspectsEnriched.length;
  const contactsComplete = contactsTotal > 0
    ? Math.round(myProspectsEnriched.reduce((sum, p) => sum + p.completeness_percent, 0) / contactsTotal)
    : 0;
  const contactsWithRegion = myProspectsEnriched.filter(p => !!p.region).length;
  const contactsWithWhatsapp = myProspectsEnriched.filter(p => p.whatsapp).length;

  const today = new Date().toISOString().slice(0, 10);
  const { data: myPotentials } = await admin.from('prospect_potentials')
    .select('id, need_id, target_contact_date').is('deleted_at', null)
    .not('status', 'in', '(converted,lost,cancelled)').eq('assigned_to', user!.id);
  const potentialsList = (myPotentials ?? []) as { id: string; need_id: string | null; target_contact_date: string | null }[];
  // 🔴 A missing target_contact_date is NOT "on time" — it means nobody scheduled a
  // next-contact date at all, which is exactly the gap lib/marketing/teamGaps.ts's
  // buildPotentialsNeedingFollowUp already flags. Treating it as on-time made this read
  // 100% for an account where every Potential still has no date set — the opposite of
  // useful. On-time now requires a real, non-overdue date.
  const potentialsOnTime = potentialsList.filter(p => !!p.target_contact_date && p.target_contact_date >= today).length;
  const potentialsTotal = potentialsList.length;

  // Document evidence — the ONE thing that actually promotes a Potential to Opportunity
  // Candidate (lib/marketing/classification.ts's classifyLead — timing/region/anything else
  // never matters). Shows what fraction of this person's Potentials are actually ready to
  // convert vs still need a layout/reference attached.
  const myNeedIds = [...new Set(potentialsList.map(p => p.need_id).filter(Boolean))] as string[];
  let potentialsWithEvidence = 0;
  if (myNeedIds.length) {
    const { data: docRows } = await admin.from('prospect_need_documents').select('need_id').in('need_id', myNeedIds);
    potentialsWithEvidence = new Set((docRows ?? []).map((d: { need_id: string }) => d.need_id)).size;
  }

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
          contactsComplete, contactsTotal, potentialsOnTime, potentialsTotal,
          contactsWithRegion, contactsWithWhatsapp,
          potentialsWithEvidence, potentialsWithNeed: myNeedIds.length,
          weeklyActivityCount: weeklyActivityCount ?? 0,
        }}
      />
    </div>
  );
}
