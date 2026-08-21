import { createClient } from '@/lib/supabase/server';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
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
        + 'owner_id, assigned_marketing_user_id, is_archived, created_at, updated_at, external_created_at')
      .is('deleted_at', null).eq('is_archived', false)
      .order('created_at', { ascending: false }).range(0, PAGE_SIZE - 1),
    sb.from('prospects').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('is_archived', false),
  ]);
  const base = (res.error ? [] : (res.data ?? [])) as Omit<ProspectRow, 'primary_contact' | 'owner_name' | 'location_count_actual' | 'potential_count' | 'opportunity_count'>[];
  const prospects: ProspectRow[] = await enrichProspectRows(sb, base);
  const total = countRes.error ? prospects.length : (countRes.count ?? 0);

  const [potTotalRes, oppTotalRes] = await Promise.all([
    sb.from('prospect_potentials').select('id').is('deleted_at', null).limit(1000),
    sb.from('opportunities').select('id').is('deleted_at', null).limit(1000),
  ]);
  const potentialTotal = potTotalRes.error ? null : (potTotalRes.data?.length ?? 0);
  const opportunityTotal = oppTotalRes.error ? null : (oppTotalRes.data?.length ?? 0);

  return (
    <div className="main-inner">
      <ProspectsPageClient
        initialProspects={prospects} initialTotal={total} pageSize={PAGE_SIZE}
        canEdit={canEdit} loadError={!!res.error}
        potentialTotal={potentialTotal} opportunityTotal={opportunityTotal}
      />
    </div>
  );
}
