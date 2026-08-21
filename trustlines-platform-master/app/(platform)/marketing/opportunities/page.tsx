import { createClient } from '@/lib/supabase/server';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_ROLES } from '@/lib/marketing/roles';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { OpportunitiesPageClient, type DealRow } from '@/components/platform/marketing/OpportunitiesPageClient';
import type { UserRole, LeadEntityType } from '@/types/database';

const WRITE_ROLES = [...SALES_HANDOFF_ROLES, ...MARKETING_ROLES];

const OPP_COLS = 'id, prospect_id, project_id, primary_contact_id, title, project_types, stage, priority, region, '
  + 'source_label, source_raw_label, marketing_owner_id, sales_owner_id, estimated_value, deposit, payment_raw, targeted, '
  + 'deadline, closed_at, industry_raw, brand, state, formatted_address, request_raw, to_do_raw, tags, '
  + 'auto_managed, admin_corrected, external_stage_label, created_at, updated_at';
const POT_COLS = 'id, prospect_id, primary_contact_id, title, potential_type, status, priority, region, '
  + 'source_raw_label, assigned_to, estimated_value, deposit, payment_raw, targeted, due_date, date_done, '
  + 'industry_raw, brand, state, formatted_address, request_raw, to_do_raw, tags, '
  + 'auto_managed, external_stage_label, created_at, updated_at';

export default async function OpportunitiesListPage() {
  await requirePage('page.marketing');
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'marketing_pr';
  const canEdit = WRITE_ROLES.includes(userRole);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [oppRes, potRes] = await Promise.all([
    sb.from('opportunities').select(OPP_COLS).is('deleted_at', null).order('updated_at', { ascending: false }).limit(2000),
    sb.from('prospect_potentials').select(POT_COLS).is('deleted_at', null).order('updated_at', { ascending: false }).limit(2000),
  ]);
  const loadError = !!oppRes.error || !!potRes.error;
  const oppBase = (oppRes.error ? [] : (oppRes.data ?? [])) as Record<string, unknown>[];
  const potBase = (potRes.error ? [] : (potRes.data ?? [])) as Record<string, unknown>[];

  const prospectIds = [...new Set([...oppBase, ...potBase].map(o => o.prospect_id as string))];
  const contactIds = [...new Set([...oppBase, ...potBase].map(o => o.primary_contact_id).filter(Boolean))] as string[];
  const projectIds = [...new Set(oppBase.map(o => o.project_id).filter(Boolean))] as string[];
  const ownerIds = [...new Set([
    ...oppBase.flatMap(o => [o.marketing_owner_id, o.sales_owner_id]),
    ...potBase.map(o => o.assigned_to),
  ].filter(Boolean))] as string[];

  let leadById: Record<string, { display_name: string; entity_type: string }> = {};
  let nameById: Record<string, string> = {};
  let contactNameById: Record<string, string> = {};
  let projectCodeById: Record<string, string> = {};
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
  if (projectIds.length) {
    const { data: projects } = await sb.from('projects').select('id, code').in('id', projectIds);
    projectCodeById = Object.fromEntries(((projects ?? []) as { id: string; code: string }[]).map(p => [p.id, p.code]));
  }

  const deals: DealRow[] = [
    ...oppBase.map(o => ({
      id: o.id as string, kind: 'opportunity' as const,
      prospect_id: o.prospect_id as string, project_id: (o.project_id as string) ?? null,
      primary_contact_id: (o.primary_contact_id as string) ?? null,
      title: o.title as string, project_types: (o.project_types as DealRow['project_types']) ?? [],
      stage: o.stage as DealRow['stage'], priority: o.priority as DealRow['priority'],
      region: (o.region as string) ?? null,
      source_label: (o.source_label as string) ?? null, source_raw_label: (o.source_raw_label as string) ?? null,
      marketing_owner_id: (o.marketing_owner_id as string) ?? null, sales_owner_id: (o.sales_owner_id as string) ?? null,
      assigned_to: null,
      estimated_value: (o.estimated_value as number) ?? null, deposit: (o.deposit as number) ?? null,
      payment_raw: (o.payment_raw as string) ?? null, targeted: !!o.targeted,
      deadline: (o.deadline as string) ?? null, due_date: null,
      closed_at: (o.closed_at as string) ?? null, date_done: null,
      industry_raw: (o.industry_raw as string) ?? null, brand: (o.brand as string) ?? null,
      state: (o.state as string) ?? null, formatted_address: (o.formatted_address as string) ?? null,
      request_raw: (o.request_raw as string) ?? null, to_do_raw: (o.to_do_raw as string) ?? null,
      external_stage_label: (o.external_stage_label as string) ?? null,
      tags: (o.tags as DealRow['tags']) ?? [],
      created_at: o.created_at as string, updated_at: o.updated_at as string,
      auto_managed: !!o.auto_managed, admin_corrected: !!o.admin_corrected,
      lead_display_name: leadById[o.prospect_id as string]?.display_name ?? '—',
      lead_entity_type: (leadById[o.prospect_id as string]?.entity_type as LeadEntityType) ?? 'organization',
      owner_name: nameById[(o.sales_owner_id as string) ?? ''] ?? nameById[(o.marketing_owner_id as string) ?? ''] ?? null,
      contact_name: o.primary_contact_id ? (contactNameById[o.primary_contact_id as string] ?? null) : null,
      project_code: o.project_id ? (projectCodeById[o.project_id as string] ?? null) : null,
    })),
    ...potBase.map(p => ({
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
      contact_name: p.primary_contact_id ? (contactNameById[p.primary_contact_id as string] ?? null) : null,
      project_code: null,
    })),
  ];

  const { data: prospectRows } = await sb.from('prospects').select('id').is('deleted_at', null).eq('is_archived', false).limit(1000);
  const prospectTotal = prospectRows ? prospectRows.length : null;

  const { data: people } = await sb.from('profiles')
    .select('id, full_name')
    .in('role', ['marketing_pr', 'marketing_manager', 'sales_rep', 'sales_marketing_manager', 'ops_manager', 'general_manager'])
    .eq('is_active', true).order('full_name', { ascending: true });

  return (
    <div className="main-inner">
      <OpportunitiesPageClient
        initialDeals={deals} canEdit={canEdit} loadError={loadError}
        prospectTotal={prospectTotal}
        assignees={people ?? []}
      />
    </div>
  );
}
