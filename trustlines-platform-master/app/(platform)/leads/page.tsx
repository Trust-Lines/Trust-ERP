import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { LeadsClient } from '@/components/platform/leads/LeadsClient';
import type { Lead, OpportunityStatus } from '@/components/platform/leads/types';
import { serviceLineLabel, composeProjectCode } from '@/lib/regions';
import { STAGE_LABELS } from '@/lib/workflow/machine';
import { loadOpportunityLeadRows } from '@/lib/marketing/opportunityRows';
import { loadPotentialLeadRows } from '@/lib/marketing/potentialRows';
import { MARKETING_ROLES } from '@/lib/marketing/roles';
import { getAssignedRegions } from '@/lib/access/regionScope';
import type { ProjectStage } from '@/types/database';

const LEADS_ALLOWED_ROLES = ['sales_marketing_manager', 'sales_rep', 'ops_manager', 'general_manager'];
const BOARD_ALLOWED_ROLES = [...LEADS_ALLOWED_ROLES, ...MARKETING_ROLES];

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role ?? '';
  if (!BOARD_ALLOWED_ROLES.includes(role)) redirect('/dashboard');
  const canSeeLeadIntake = LEADS_ALLOWED_ROLES.includes(role);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = createAdminClient() as any;

  let leads: Lead[] = [];
  let assignees: { id: string; full_name: string }[] = [];
  let truncated = false;
  let canManageNumber = false;
  let nextNumber = 1;

  if (canSeeLeadIntake) {
    const LEADS_LIMIT = 1000;
    let q = adm.from('lead_intake')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(LEADS_LIMIT);
    if (role === 'sales_rep') {
      const myRegions = await getAssignedRegions(adm, user.id);
      q = myRegions.length > 0 ? q.in('region', myRegions) : q.eq('created_by', user.id);
    }
    const { data: rows } = await q;
    truncated = (rows?.length ?? 0) >= LEADS_LIMIT;

    const list = ((rows ?? []) as Record<string, unknown>[]).filter(r => !r.deleted_at);

    const personIds = [...new Set(list.flatMap(r => [r.created_by, r.assignee_id]).filter(Boolean))] as string[];
    const [peopleRes, repsRes] = await Promise.all([
      personIds.length ? adm.from('profiles').select('id, full_name').in('id', personIds) : Promise.resolve({ data: [] }),
      adm.from('profiles').select('id, full_name').in('role', ['sales_rep', 'sales_marketing_manager']).eq('is_active', true).order('full_name'),
    ]);
    const nameById = new Map(((peopleRes.data ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]));
    assignees = (repsRes.data ?? []) as { id: string; full_name: string }[];

    const leadIds = list.map(r => r.id as string);
    const { data: taskRows } = leadIds.length
      ? await adm.from('lead_tasks').select('lead_intake_id, status').in('lead_intake_id', leadIds)
      : { data: [] };
    const taskAgg = new Map<string, { done: number; total: number }>();
    for (const t of ((taskRows ?? []) as { lead_intake_id: string; status: string }[])) {
      const cur = taskAgg.get(t.lead_intake_id) ?? { done: 0, total: 0 };
      cur.total += 1;
      if (t.status === 'done') cur.done += 1;
      taskAgg.set(t.lead_intake_id, cur);
    }

    const deliveredProjectIds = [...new Set(list.filter(r => r.is_delivered && r.project_id).map(r => r.project_id))] as string[];
    const { data: projRows } = deliveredProjectIds.length
      ? await adm.from('projects').select('id, current_stage').in('id', deliveredProjectIds)
      : { data: [] };
    const stageByProject = new Map(((projRows ?? []) as { id: string; current_stage: string }[]).map(p => [p.id, p.current_stage]));

    const PRIORITIES = new Set(['high', 'medium', 'low']);

    leads = list.map(r => {
      const city = (r.city as string) ?? '';
      const state = (r.state as string) ?? '';
      const delivered = !!r.is_delivered;
      const priority = PRIORITIES.has(r.priority as string) ? (r.priority as 'high' | 'medium' | 'low') : 'medium';
      const assigneeName = (nameById.get(r.assignee_id as string) as string)
        ?? (nameById.get(r.created_by as string) as string) ?? 'Unassigned';
      return {
        id:                 r.id as string,
        name:               (r.customer_name as string) || (r.brand as string) || 'Untitled lead',
        project_no:         r.project_number != null
          ? composeProjectCode(r.service_line as string, r.region as string, r.project_number as number)
          : null,
        industry:           (r.industry as string) || '—',
        brand:              (r.brand as string) || '—',
        state:              state || '—',
        priority,
        assignee_id:        (r.assignee_id as string) ?? null,
        opportunity_status: (r.opportunity_status as OpportunityStatus) ?? 'new_opportunity',
        to_do:              (r.next_action as string) || (delivered ? 'Delivered' : 'In intake'),
        contact:            (r.contact_person as string) || '—',
        assignee:           assigneeName,
        design_status:      delivered
          ? (STAGE_LABELS[stageByProject.get(r.project_id as string) as ProjectStage] ?? 'Delivered')
          : 'Draft',
        request:            serviceLineLabel(r.service_line as string) || '—',
        project_type:       (r.project_type as string) || '—',
        deal_size:          r.deal_size != null ? Number(r.deal_size) : null,
        follow_up_date:     (r.follow_up_date as string) ?? null,
        tags:               Array.isArray(r.tags) ? (r.tags as string[]) : [],
        checklist_total:    Array.isArray(r.checklist) ? (r.checklist as unknown[]).length : 0,
        checklist_done:     Array.isArray(r.checklist) ? (r.checklist as { done?: boolean }[]).filter(c => c.done).length : 0,
        tasks_total:        taskAgg.get(r.id as string)?.total ?? 0,
        tasks_done:         taskAgg.get(r.id as string)?.done ?? 0,
        archived:           !!r.is_archived,
        location:           [city, state].filter(Boolean).join(', ') || '—',
        date_created:       (r.created_at as string) ?? '',
        date_done:          null,
        source:             (r.source as string) || 'Sales form',
        origin:             'lead_intake',
        region:             (r.region as string) ?? null,
      };
    });

    canManageNumber = ['sales_marketing_manager', 'ops_manager', 'general_manager'].includes(role);
    if (canManageNumber) {
      const { data } = await adm.rpc('peek_global_number');
      nextNumber = (data as number) ?? 1;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opportunityLeads = await loadOpportunityLeadRows(supabase as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const potentialLeads = await loadPotentialLeadRows(supabase as any);
  const allLeads = [...leads, ...opportunityLeads, ...potentialLeads];

  const { data: marketingAssignees } = await adm.from('profiles')
    .select('id, full_name')
    .in('role', ['marketing_pr', 'marketing_manager', 'sales_rep', 'sales_marketing_manager', 'ops_manager', 'general_manager'])
    .eq('is_active', true).order('full_name', { ascending: true });

  return (
    <div style={{ padding: '24px 32px' }}>
      <LeadsClient
        initialLeads={allLeads} assignees={assignees} marketingAssignees={marketingAssignees ?? []}
        currentUserId={user.id} canManageNumber={canManageNumber} nextNumber={nextNumber}
        truncatedAt={truncated ? 1000 : undefined} canSeeLeadIntake={canSeeLeadIntake}
      />
    </div>
  );
}
