import { createClient } from '@/lib/supabase/server';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';

// Per-user, RLS-scoped counts — never serve a cached render across users/sessions
// (reported: Lead Cloud sometimes showing a stale 0 after the region-visibility fix).
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { enrichProspectRows } from '@/lib/marketing/prospectRows';
import { ProspectsPageClient, type ProspectRow } from '@/components/platform/marketing/ProspectsPageClient';
import type { UserRole } from '@/types/database';

const PAGE_SIZE = 50;

export default async function ProspectsListPage() {
  await requirePage('page.marketing');
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'marketing_pr';

  const canEdit = MARKETING_WRITE_ROLES.includes(userRole);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [res, countRes] = await Promise.all([
    sb.from('prospects')
      .select('id, entity_type, display_name, organization_name, person_name, brand_name, industry, status, location_count, source_label, source_raw_label, source_detail, business_types, tags, main_email, main_phone, website, x_note, region, '
        + 'project_types, scope_types, timing, next_action, next_action_date, target_contact_date, '
        + 'owner_id, assigned_marketing_user_id, is_archived, created_at, updated_at, external_created_at, effective_created_at')
      .is('deleted_at', null).eq('is_archived', false)
      // Placeholder Contacts created by clickup-import-potentials-only.mts's --allow-fallback
      // (address as the name, no real Contact behind a Potential-stage deal) don't belong
      // on this page — see the matching filter in app/api/marketing/prospects/route.ts.
      // `.or()` with an explicit `is.null` branch, NOT a plain `.not('external_ref','like',…)`
      // — that alone silently drops every Contact with a NULL external_ref too (SQL's
      // `NOT (NULL LIKE 'x%')` is NULL, not TRUE, so WHERE excludes it).
      .or('external_ref.is.null,external_ref.not.like.opportunity-fallback:%')
      // effective_created_at (migration 114) = COALESCE(external_created_at, created_at) —
      // real ClickUp date when there is one, our own created_at otherwise. Matches the sort
      // this page's own client-side refetch uses (app/api/marketing/prospects/route.ts).
      .order('effective_created_at', { ascending: false }).range(0, PAGE_SIZE - 1),
    sb.from('prospects').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('is_archived', false)
      .or('external_ref.is.null,external_ref.not.like.opportunity-fallback:%'),
  ]);
  const base = (res.error ? [] : (res.data ?? [])) as Omit<ProspectRow, 'primary_contact' | 'owner_name' | 'location_count_actual' | 'potential_count' | 'opportunity_count'>[];
  const prospects: ProspectRow[] = await enrichProspectRows(sb, base);
  const total = countRes.error ? prospects.length : (countRes.count ?? 0);

  // count-only head requests — a row-returning select().limit(1000) silently caps at 1000
  // via PostgREST's own default regardless of the .limit() value once real data passes it
  // (bit us on this exact pattern elsewhere in this module, 2026-09-17).
  const [potTotalRes, oppTotalRes] = await Promise.all([
    sb.from('prospect_potentials').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    sb.from('opportunities').select('id', { count: 'exact', head: true }).is('deleted_at', null),
  ]);
  const potentialTotal = potTotalRes.error ? null : (potTotalRes.count ?? 0);
  const opportunityTotal = oppTotalRes.error ? null : (oppTotalRes.count ?? 0);

  return (
    <div style={{ padding: '24px 32px' }}>
      <ProspectsPageClient
        initialProspects={prospects} initialTotal={total} pageSize={PAGE_SIZE}
        canEdit={canEdit} loadError={!!res.error}
        potentialTotal={potentialTotal} opportunityTotal={opportunityTotal}
      />
    </div>
  );
}
