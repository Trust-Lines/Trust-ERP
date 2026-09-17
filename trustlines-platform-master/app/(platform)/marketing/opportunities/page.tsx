import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_ROLES, MARKETING_SEE_ALL_ROLES } from '@/lib/marketing/roles';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { OpportunitiesPageClient, type DealRow } from '@/components/platform/marketing/OpportunitiesPageClient';
import type { UserRole, LeadEntityType } from '@/types/database';

// Per-user, RLS-scoped counts — never serve a cached render across users/sessions.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WRITE_ROLES = [...SALES_HANDOFF_ROLES, ...MARKETING_ROLES];

const POT_COLS = 'id, prospect_id, primary_contact_id, title, potential_type, status, priority, region, '
  + 'source_raw_label, assigned_to, estimated_value, deposit, payment_raw, targeted, due_date, date_done, '
  + 'industry_raw, brand, state, formatted_address, request_raw, to_do_raw, tags, external_project_code, '
  + 'auto_managed, external_stage_label, created_at, updated_at';

export default async function OpportunitiesListPage() {
  await requirePage('page.marketing');
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'marketing_pr';

  // 🔴 2026-09-17: this board shows Opportunities/Potentials by their deal fields —
  // formatted_address, state — which is real Sales pipeline data (project/store addresses),
  // not the contact-first view marketing_pr's job actually needs. marketing_pr's whole job
  // is Contacts + Potentials (chase missing contact info, nurture a Potential toward real
  // document evidence); their Potentials work happens in Contacts filtered to
  // status=potential (person/company names), not here. This page was already hidden from
  // their sidebar nav but still directly URL-reachable — block it outright, same pattern as
  // /leads's role gate for non-Sales roles, and send them to the screen that's actually theirs.
  if (!MARKETING_SEE_ALL_ROLES.includes(userRole)) redirect('/marketing/prospects?status=potential');

  const canEdit = WRITE_ROLES.includes(userRole);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  // 🔴 2026-09-17: dropped the `opportunities` query entirely — once a Potential is handed
  // off to Sales it becomes their board's business (/leads, which already merges Marketing's
  // Opportunities/Potentials in), not Marketing's. This page is Marketing's Potentials-only
  // work queue now, matching the "op kalkacak, o kesin, onlar Sales'in işi" decision this
  // whole module has been moving toward all session.
  const { data: potData, error: potError } = await sb.from('prospect_potentials')
    .select(POT_COLS).is('deleted_at', null).not('status', 'in', '(converted,lost,cancelled)')
    .order('updated_at', { ascending: false }).limit(2000);
  const loadError = !!potError;
  const potBase = (potError ? [] : (potData ?? [])) as Record<string, unknown>[];

  const prospectIds = [...new Set(potBase.map(o => o.prospect_id as string))];
  const contactIds = [...new Set(potBase.map(o => o.primary_contact_id).filter(Boolean))] as string[];
  const ownerIds = [...new Set(potBase.map(o => o.assigned_to).filter(Boolean))] as string[];

  let leadById: Record<string, { display_name: string; entity_type: string }> = {};
  let nameById: Record<string, string> = {};
  let contactNameById: Record<string, string> = {};
  if (prospectIds.length) {
    const { data: leads } = await sb.from('prospects').select('id, display_name, entity_type').in('id', prospectIds);
    leadById = Object.fromEntries(((leads ?? []) as { id: string; display_name: string; entity_type: string }[]).map(l => [l.id, l]));
  }
  if (ownerIds.length) {
    const { data: people } = await sb.from('profiles').select('id, full_name').in('id', ownerIds);
    nameById = Object.fromEntries(((people ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]));
  }
  if (contactIds.length) {
    const { data: contacts } = await sb.from('prospect_contacts').select('id, name').in('id', contactIds);
    contactNameById = Object.fromEntries(((contacts ?? []) as { id: string; name: string }[]).map(c => [c.id, c.name]));
  }

  const deals: DealRow[] = potBase.map(p => ({
    id: p.id as string, kind: 'potential' as const,
    prospect_id: p.prospect_id as string, project_id: null,
    primary_contact_id: (p.primary_contact_id as string) ?? null,
    title: p.title as string, project_types: [],
    stage: null, priority: (p.priority as DealRow['priority']) ?? 'medium',
    region: (p.region as string) ?? null,
    source_label: null, source_raw_label: (p.source_raw_label as string) ?? null,
    marketing_owner_id: null, sales_owner_id: null, assigned_to: (p.assigned_to as string) ?? null,
    estimated_value: (p.estimated_value as number) ?? null, deposit: (p.deposit as number) ?? null,
    payment_raw: (p.payment_raw as string) ?? null, targeted: !!p.targeted,
    deadline: null, due_date: (p.due_date as string) ?? null,
    closed_at: null, date_done: (p.date_done as string) ?? null,
    industry_raw: (p.industry_raw as string) ?? null, brand: (p.brand as string) ?? null,
    state: (p.state as string) ?? null, formatted_address: (p.formatted_address as string) ?? null,
    request_raw: (p.request_raw as string) ?? null, to_do_raw: (p.to_do_raw as string) ?? null,
    external_stage_label: (p.external_stage_label as string) ?? null,
    tags: (p.tags as DealRow['tags']) ?? [],
    created_at: p.created_at as string, updated_at: p.updated_at as string,
    auto_managed: !!p.auto_managed, admin_corrected: false,
    lead_display_name: leadById[p.prospect_id as string]?.display_name ?? '—',
    lead_entity_type: (leadById[p.prospect_id as string]?.entity_type as LeadEntityType) ?? 'organization',
    owner_name: nameById[(p.assigned_to as string) ?? ''] ?? null,
    sales_rep_name: null,
    contact_name: p.primary_contact_id ? (contactNameById[p.primary_contact_id as string] ?? null) : null,
    project_code: null,
    external_project_code: (p.external_project_code as string) ?? null,
  }));

  // 🔴 2026-09-17: was `.select('id')...limit(1000)` read into `.length` — PostgREST caps
  // any row-returning select at 1000 regardless of .limit(), so this silently stuck at 1000
  // once real Contacts count passed it (1758 in reality). count-only head request instead.
  const { count: prospectCount } = await sb.from('prospects').select('id', { count: 'exact', head: true })
    .is('deleted_at', null).eq('is_archived', false).not('external_ref', 'like', 'opportunity-fallback:%');
  const prospectTotal = prospectCount ?? null;

  const { data: people } = await sb.from('profiles')
    .select('id, full_name')
    .in('role', ['marketing_pr', 'marketing_manager', 'sales_rep', 'sales_marketing_manager', 'ops_manager', 'general_manager'])
    .eq('is_active', true).order('full_name', { ascending: true });

  return (
    <div style={{ padding: '24px 32px' }}>
      <OpportunitiesPageClient
        initialDeals={deals} canEdit={canEdit} loadError={loadError}
        prospectTotal={prospectTotal}
        assignees={people ?? []}
      />
    </div>
  );
}
