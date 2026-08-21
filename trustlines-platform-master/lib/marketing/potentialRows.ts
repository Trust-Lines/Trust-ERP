
/* eslint-disable @typescript-eslint/no-explicit-any */

import { PROJECT_TYPE_LABEL } from './classification';
import { normalizeIndustry } from './industry';
import type { Lead, OpportunityStatus } from '@/components/platform/leads/types';

interface PotBase {
  id: string; need_id: string; prospect_id: string; title: string;
  target_contact_date: string | null; estimated_value: number | null; assigned_to: string | null;
  external_stage_label: string | null; created_at: string;
  primary_contact_id: string | null; region: string | null; priority: 'low' | 'medium' | 'high';
  due_date: string | null; date_done: string | null; deposit: number | null; payment_raw: string | null; targeted: boolean;
  industry_raw: string | null; brand: string | null; state: string | null; formatted_address: string | null;
  request_raw: string | null; to_do_raw: string | null; source_raw_label: string | null;
  tags: { name: string; color: string }[] | null;
  external_project_code: string | null;
}

function bucketFor(externalStageLabel: string | null): OpportunityStatus {
  if (externalStageLabel?.trim() === 'In Target List') return 'in_target_list';
  return 'potential';
}

export async function loadPotentialLeadRows(sb: any): Promise<Lead[]> {
  const res = await sb.from('prospect_potentials')
    .select('id, need_id, prospect_id, title, target_contact_date, estimated_value, assigned_to, external_stage_label, created_at, '
      + 'primary_contact_id, region, priority, due_date, date_done, deposit, payment_raw, targeted, '
      + 'industry_raw, brand, state, formatted_address, request_raw, to_do_raw, source_raw_label, tags, external_project_code')
    .is('deleted_at', null)
    .not('status', 'in', '(converted,lost,cancelled)')
    .order('created_at', { ascending: false }).limit(2000);
  const base = (res.error ? [] : (res.data ?? [])) as PotBase[];
  if (base.length === 0) return [];

  const needIds = [...new Set(base.map(p => p.need_id))];
  const prospectIds = [...new Set(base.map(p => p.prospect_id))];
  const contactIds = [...new Set(base.map(p => p.primary_contact_id).filter(Boolean))] as string[];
  const assigneeIds = [...new Set(base.map(p => p.assigned_to).filter(Boolean))] as string[];

  const [needsRes, leadsRes, ownersRes, contactsRes] = await Promise.all([
    sb.from('prospect_needs').select('id, state, region, source, project_types').in('id', needIds),
    sb.from('prospects').select('id, display_name, industry, brand_name').in('id', prospectIds),
    assigneeIds.length ? sb.from('profiles').select('id, full_name').in('id', assigneeIds) : Promise.resolve({ data: [] }),
    contactIds.length ? sb.from('prospect_contacts').select('id, name').in('id', contactIds) : Promise.resolve({ data: [] }),
  ]);

  const needById = Object.fromEntries(((needsRes.data ?? []) as { id: string; state: string | null; region: string | null; source: string | null; project_types: string[] }[]).map(n => [n.id, n]));
  const leadById = Object.fromEntries(((leadsRes.data ?? []) as { id: string; display_name: string; industry: string | null; brand_name: string | null }[]).map(l => [l.id, l]));
  const nameById = Object.fromEntries(((ownersRes.data ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]));
  const contactNameById = Object.fromEntries(((contactsRes.data ?? []) as { id: string; name: string }[]).map(c => [c.id, c.name]));

  return base.map(p => {
    const need = needById[p.need_id];
    const lead = leadById[p.prospect_id];
    const projectTypes = (need?.project_types ?? []) as string[];
    return {
      id: p.id,
      prospect_id: p.prospect_id,
      name: p.title || lead?.display_name || 'Untitled potential',
      project_no: p.external_project_code ?? null,
      industry: normalizeIndustry(p.industry_raw || lead?.industry) || '—',
      brand: p.brand || lead?.brand_name || '—',
      state: p.state || need?.state || '—',
      priority: p.priority || 'medium',
      assignee_id: p.assigned_to,
      opportunity_status: bucketFor(p.external_stage_label),
      to_do: p.to_do_raw || '—',
      contact: p.primary_contact_id ? (contactNameById[p.primary_contact_id] ?? '—') : '—',
      assignee: nameById[p.assigned_to ?? ''] ?? 'Unassigned',
      design_status: '—',
      request: p.request_raw || '—',
      project_type: projectTypes.length ? projectTypes.map(t => PROJECT_TYPE_LABEL[t as keyof typeof PROJECT_TYPE_LABEL] ?? t).join(', ') : '—',
      deal_size: p.estimated_value,
      deposit: p.deposit,
      payment_raw: p.payment_raw,
      targeted: p.targeted,
      due_date: p.due_date,
      external_stage_label: p.external_stage_label,
      follow_up_date: p.target_contact_date,
      tags: (p.tags ?? []).map(t => t.name),
      tag_pills: p.tags ?? [],
      checklist_done: 0,
      checklist_total: 0,
      tasks_done: 0,
      tasks_total: 0,
      archived: false,
      location: p.formatted_address || need?.state || '—',
      date_created: p.created_at,
      date_done: p.date_done,
      source: p.source_raw_label || need?.source || 'Marketing',
      origin: 'potential',
      region: p.region ?? need?.region ?? null,
    };
  });
}
