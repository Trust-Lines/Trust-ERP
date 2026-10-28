import { redirect } from 'next/navigation';
import { requirePage } from '@/lib/permissions/requirePage';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { TasksClient, TASK_QUICK_FILTERS, type TaskQuickFilter, type TaskRow } from '@/components/platform/sales/TasksClient';
import { SALES_INTAKE_ROLES } from '@/lib/sales/roles';
import { fetchInChunks } from '@/lib/supabase/chunkedIn';
import { getAssignedRegions, regionAllows } from '@/lib/access/regionScope';
import { OPPORTUNITY_STAGE_LABEL } from '@/lib/marketing/classification';
import type { OpportunityStage } from '@/types/database';

// Open pipeline stages a new task can be attached to (same set the Handoffs page works).
const OPEN_SALES_STAGES = ['sales_handoff', 'sales_accepted', 'discovery', 'sales_design', 'proposal', 'negotiation'];

export default async function SalesTasksPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  // Roles & Permissions switch (catalog.ts PAGE_LEGACY_ROLES keeps the old role list as default).
  await requirePage('page.sales_tasks');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role ?? '';
  if (!SALES_INTAKE_ROLES.includes(role)) redirect('/dashboard');
  const { filter } = await searchParams;
  const initialFilter = TASK_QUICK_FILTERS.find(f => f === filter) as TaskQuickFilter | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = createAdminClient() as any;

  // Both kinds of Sales task: those on an old-style lead intake, and those on a pipeline Opportunity
  // (the auto-generated follow-ups from lib/sales/syncTasks.ts live on the latter).
  const { data: taskRows } = await adm.from('lead_tasks')
    .select('id, lead_intake_id, opportunity_id, title, status, assignee_id, due_date, created_at, completed_at')
    .or('lead_intake_id.not.is.null,opportunity_id.not.is.null')
    .order('created_at', { ascending: false })
    .limit(2000);
  const rawTasks = (taskRows ?? []) as {
    id: string; lead_intake_id: string | null; opportunity_id: string | null; title: string; status: TaskRow['status'];
    assignee_id: string | null; due_date: string | null; created_at: string; completed_at: string | null;
  }[];

  const leadIds = [...new Set(rawTasks.map(t => t.lead_intake_id).filter(Boolean))] as string[];
  const oppIds = [...new Set(rawTasks.map(t => t.opportunity_id).filter(Boolean))] as string[];
  const [leads, opps, repsRes, myRegions, openOppsRes] = await Promise.all([
    fetchInChunks(leadIds, chunk => adm.from('lead_intake').select('id, customer_name, brand, created_by, created_at, deleted_at').in('id', chunk)),
    fetchInChunks(oppIds, chunk => adm.from('opportunities').select('id, title, brand, stage, region, created_at, external_created_at, deleted_at').in('id', chunk)),
    // Everyone who can work Sales tasks — managers included, so the pool can always be picked up.
    adm.from('profiles').select('id, full_name').in('role', SALES_INTAKE_ROLES).eq('is_active', true).order('full_name'),
    role === 'sales_rep' ? getAssignedRegions(adm, user.id) : Promise.resolve([] as string[]),
    adm.from('opportunities').select('id, title, brand, region, sales_owner_id')
      .in('stage', OPEN_SALES_STAGES).is('deleted_at', null).order('created_at', { ascending: false }).limit(1000),
  ]);
  const leadById = new Map((leads as { id: string; customer_name: string | null; brand: string | null; created_by: string | null; created_at: string; deleted_at: string | null }[]).map(l => [l.id, l]));
  const oppById = new Map((opps as { id: string; title: string | null; brand: string | null; stage: OpportunityStage; region: string | null; created_at: string; external_created_at: string | null; deleted_at: string | null }[]).map(o => [o.id, o]));
  const assignees = (repsRes.data ?? []) as { id: string; full_name: string }[];
  const nameById = new Map(assignees.map(a => [a.id, a.full_name]));

  const tasks: TaskRow[] = [];
  for (const t of rawTasks) {
    const base = {
      id: t.id, title: t.title, status: t.status, assignee_id: t.assignee_id,
      assignee_name: t.assignee_id ? (nameById.get(t.assignee_id) ?? null) : null,
      due_date: t.due_date, created_at: t.created_at, completed_at: t.completed_at,
    };
    if (t.opportunity_id) {
      const opp = oppById.get(t.opportunity_id);
      if (!opp || opp.deleted_at) continue;
      // A sales_rep works their own tasks plus the unassigned ones in their regions.
      if (role === 'sales_rep' && t.assignee_id !== user.id && !(t.assignee_id == null && regionAllows(myRegions, opp.region))) continue;
      tasks.push({
        ...base, kind: 'opportunity', lead_id: t.opportunity_id,
        lead_name: opp.title?.trim() || opp.brand?.trim() || 'Untitled opportunity',
        deal_stage: OPPORTUNITY_STAGE_LABEL[opp.stage] ?? opp.stage,
        // Same date the CRM board shows as "Date created" (ClickUp date when it came from ClickUp).
        deal_date: opp.external_created_at ?? opp.created_at,
      });
    } else if (t.lead_intake_id) {
      const lead = leadById.get(t.lead_intake_id);
      if (!lead || lead.deleted_at) continue;
      if (role === 'sales_rep' && t.assignee_id !== user.id && lead.created_by !== user.id) continue;
      tasks.push({
        ...base, kind: 'lead', lead_id: t.lead_intake_id,
        lead_name: lead.customer_name?.trim() || lead.brand?.trim() || 'Untitled lead',
        deal_stage: null,
        deal_date: lead.created_at,
      });
    }
  }

  // Deals the New Task dialog offers — every open deal this user can work, not only those that
  // already have a task. The task API re-checks access (assertOpportunityAccess).
  const deals = ((openOppsRes.data ?? []) as { id: string; title: string | null; brand: string | null; region: string | null; sales_owner_id: string | null }[])
    // Same rule as canAccessOpportunity: a rep with regions works those regions, otherwise their own deals.
    .filter(o => role !== 'sales_rep' || (myRegions.length > 0 ? regionAllows(myRegions, o.region) : o.sales_owner_id === user.id))
    .map(o => ({ id: o.id, name: o.title?.trim() || o.brand?.trim() || 'Untitled opportunity' }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div style={{ padding: 28 }}>
      <TasksClient tasks={tasks} assignees={assignees} currentUserId={user.id} openDeals={deals} initialFilter={initialFilter} />
    </div>
  );
}
