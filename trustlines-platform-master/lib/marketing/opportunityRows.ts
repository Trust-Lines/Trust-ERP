
import { OPPORTUNITY_STAGE_LABEL, PROJECT_TYPE_LABEL } from './classification';
import { normalizeIndustry } from './industry';
import type { Lead, OpportunityStatus } from '@/components/platform/leads/types';
import type { OpportunityStage } from '@/types/database';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const STAGE_TO_STATUS: Record<OpportunityStage, OpportunityStatus> = {
  new: 'new_opportunity', marketing_qualification: 'new_opportunity', qualified_for_sales: 'new_opportunity', sales_handoff: 'new_opportunity',
  sales_accepted: 'ready_to_start',
  negotiation: 'modification_request',
  discovery: 'design_proposal_sent', sales_design: 'design_proposal_sent', proposal: 'design_proposal_sent',
  working_on_it_trust: 'working_on_it_trust',
  on_hold: 'waiting',
  closed_won: 'deal_closed',
  closed_lost: 'deal_missed',
};

export const STATUS_TO_STAGE: Record<OpportunityStatus, OpportunityStage | null> = {
  new_opportunity: 'marketing_qualification',
  ready_to_start: 'sales_accepted',
  modification_request: 'negotiation',
  working_on_it_trust: 'working_on_it_trust',
  design_proposal_sent: 'sales_design',
  waiting_from_op: null,
  contract_stage: null,
  waiting: 'on_hold',
  deal_closed: 'closed_won',
  deal_missed: 'closed_lost',
  potential: null,
  in_target_list: null,
};

interface OppBase {
  id: string; prospect_id: string; project_id: string | null; primary_contact_id: string | null;
  title: string; project_types: string[]; stage: OpportunityStage; priority: 'low' | 'medium' | 'high';
  source_label: string | null; source_raw_label: string | null; marketing_owner_id: string | null; sales_owner_id: string | null;
  estimated_value: number | null; deposit: number | null; payment_raw: string | null; targeted: boolean;
  next_action: string | null; next_action_date: string | null; deadline: string | null;
  created_at: string; closed_at: string | null; region: string | null;
  industry_raw: string | null; brand: string | null; state: string | null; formatted_address: string | null;
  request_raw: string | null; to_do_raw: string | null; external_stage_label: string | null;
  tags: { name: string; color: string }[] | null;
  external_project_code: string | null;
}

export async function loadOpportunityLeadRows(sb: any): Promise<Lead[]> {
  const res = await sb.from('opportunities')
    .select('id, prospect_id, project_id, primary_contact_id, title, project_types, stage, priority, '
      + 'source_label, source_raw_label, marketing_owner_id, sales_owner_id, estimated_value, deposit, payment_raw, targeted, '
      + 'next_action, next_action_date, deadline, created_at, closed_at, region, '
      + 'industry_raw, brand, state, formatted_address, request_raw, to_do_raw, external_stage_label, tags, external_project_code')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false }).limit(2000);
  const base = (res.error ? [] : (res.data ?? [])) as OppBase[];
  if (base.length === 0) return [];

  const prospectIds = [...new Set(base.map(o => o.prospect_id))];
  const contactIds = [...new Set(base.map(o => o.primary_contact_id).filter(Boolean))] as string[];
  const projectIds = [...new Set(base.map(o => o.project_id).filter(Boolean))] as string[];
  const ownerIds = [...new Set(base.flatMap(o => [o.marketing_owner_id, o.sales_owner_id]).filter(Boolean))] as string[];
  const oppIds = base.map(o => o.id);

  const [leadsRes, locsRes, ownersRes, contactsRes, projectsRes, tasksRes] = await Promise.all([
    sb.from('prospects').select('id, display_name, industry, brand_name').in('id', prospectIds),
    sb.from('prospect_locations').select('prospect_id, city, state').in('prospect_id', prospectIds).order('created_at', { ascending: true }),
    ownerIds.length ? sb.from('profiles').select('id, full_name').in('id', ownerIds) : Promise.resolve({ data: [] }),
    contactIds.length ? sb.from('prospect_contacts').select('id, name').in('id', contactIds) : Promise.resolve({ data: [] }),
    projectIds.length ? sb.from('projects').select('id, code').in('id', projectIds) : Promise.resolve({ data: [] }),
    sb.from('lead_tasks').select('opportunity_id, status').in('opportunity_id', oppIds),
  ]);

  const leadById = Object.fromEntries(((leadsRes.data ?? []) as { id: string; display_name: string; industry: string | null; brand_name: string | null }[]).map(l => [l.id, l]));
  const cityStateByProspect: Record<string, { city: string | null; state: string | null }> = {};
  for (const loc of (locsRes.data ?? []) as { prospect_id: string; city: string | null; state: string | null }[]) {
    if (!cityStateByProspect[loc.prospect_id]) cityStateByProspect[loc.prospect_id] = { city: loc.city, state: loc.state };
  }
  const nameById = Object.fromEntries(((ownersRes.data ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]));
  const contactNameById = Object.fromEntries(((contactsRes.data ?? []) as { id: string; name: string }[]).map(c => [c.id, c.name]));
  const projectCodeById = Object.fromEntries(((projectsRes.data ?? []) as { id: string; code: string }[]).map(p => [p.id, p.code]));
  const taskAgg = new Map<string, { done: number; total: number }>();
  for (const t of ((tasksRes.data ?? []) as { opportunity_id: string; status: string }[])) {
    const cur = taskAgg.get(t.opportunity_id) ?? { done: 0, total: 0 };
    cur.total += 1;
    if (t.status === 'done') cur.done += 1;
    taskAgg.set(t.opportunity_id, cur);
  }

  return base.map(o => {
    const lead = leadById[o.prospect_id];
    const loc = cityStateByProspect[o.prospect_id];
    const projectTypes = (o.project_types ?? []) as string[];
    return {
      id: o.id,
      name: o.title || lead?.display_name || 'Untitled opportunity',
      project_no: (o.project_id ? projectCodeById[o.project_id] : null) ?? o.external_project_code ?? null,
      industry: normalizeIndustry(o.industry_raw || lead?.industry) || '—',
      brand: o.brand || lead?.brand_name || '—',
      state: o.state || loc?.state || '—',
      priority: o.priority,
      assignee_id: o.sales_owner_id ?? o.marketing_owner_id ?? null,
      opportunity_status: STAGE_TO_STATUS[o.stage],
      to_do: o.to_do_raw || o.next_action || '—',
      contact: o.primary_contact_id ? (contactNameById[o.primary_contact_id] ?? '—') : '—',
      assignee: nameById[o.sales_owner_id ?? ''] ?? nameById[o.marketing_owner_id ?? ''] ?? 'Unassigned',
      design_status: OPPORTUNITY_STAGE_LABEL[o.stage],
      request: o.request_raw || '—',
      project_type: projectTypes.length ? projectTypes.map(t => PROJECT_TYPE_LABEL[t as keyof typeof PROJECT_TYPE_LABEL] ?? t).join(', ') : '—',
      deal_size: o.estimated_value,
      deposit: o.deposit,
      payment_raw: o.payment_raw,
      targeted: o.targeted,
      due_date: o.deadline,
      external_stage_label: o.external_stage_label,
      follow_up_date: o.next_action_date,
      tags: (o.tags ?? []).map(t => t.name),
      tag_pills: o.tags ?? [],
      checklist_done: 0,
      checklist_total: 0,
      tasks_done: taskAgg.get(o.id)?.done ?? 0,
      tasks_total: taskAgg.get(o.id)?.total ?? 0,
      archived: false,
      location: o.formatted_address || [loc?.city, loc?.state].filter(Boolean).join(', ') || '—',
      date_created: o.created_at,
      date_done: o.closed_at,
      source: o.source_raw_label || o.source_label || 'Marketing',
      origin: 'opportunity',
      region: o.region,
    };
  });
}
