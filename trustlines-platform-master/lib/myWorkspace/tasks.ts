import { canAccessOpportunity } from '@/lib/marketing/opportunityAccess';
import { canAccessPotential } from '@/lib/marketing/potentialAccess';
import { quickViewLink } from '@/lib/marketing/quickViewLink';
import { SALES_HANDOFF_ROLES, SALES_INTAKE_ROLES } from '@/lib/sales/roles';
import { MARKETING_ROLES } from '@/lib/marketing/roles';
import { CUSTOMER_COMMS_WRITE_ROLES } from '@/lib/customers/roles';
import { pageAllowed, type PermMap } from '@/lib/permissions/catalog';
import type { MyTask, MyTaskStatus } from './taskTypes';

export type { MyTask } from './taskTypes';

/* eslint-disable @typescript-eslint/no-explicit-any */

// My Workspace → My Tasks: the tasks assigned to one person, read from the task tables that
// already exist — nothing is copied or created here.
//   lead_tasks           Sales / Marketing tasks on a deal (Opportunity, Potential or old lead intake)
//   customer_follow_ups  T-Lines PM follow-ups on a customer / project
// Each row keeps the access rule of the page and API that own it: a task shows only when the
// person could open its record there, and is editable only when that record's task API would
// accept the change. Status changes go to those same APIs (see statusApi).

/** Done tasks stay on the list this long, so a just-finished one can still be found and reopened. */
const DONE_DAYS = 30;
const MAX_ROWS = 500;

const OPP_TASK_ROLES = [...SALES_HANDOFF_ROLES, ...MARKETING_ROLES];

const name = (...parts: (string | null | undefined)[]) => parts.map(p => p?.trim()).find(Boolean) ?? '';

export async function loadMyTasks(admin: any, userId: string, role: string, perms: PermMap | null): Promise<MyTask[]> {
  const doneSince = new Date(Date.now() - DONE_DAYS * 86_400_000).toISOString();
  const [leadRes, fuRes] = await Promise.all([
    admin.from('lead_tasks')
      .select('id, lead_intake_id, opportunity_id, potential_id, title, status, due_date, completed_at')
      .eq('assignee_id', userId)
      .or(`status.neq.done,completed_at.gte."${doneSince}"`)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(MAX_ROWS),
    admin.from('customer_follow_ups')
      .select('id, customer_id, project_id, note, due_date, status, completed_at')
      .eq('assignee_id', userId).is('deleted_at', null)
      .or(`status.eq.open,and(status.eq.done,completed_at.gte."${doneSince}")`)
      .order('due_date', { ascending: true })
      .limit(MAX_ROWS),
  ]);
  if (leadRes.error) throw new Error(`lead_tasks: ${leadRes.error.message}`);
  if (fuRes.error) throw new Error(`customer_follow_ups: ${fuRes.error.message}`);

  const leadTasks = (leadRes.data ?? []) as {
    id: string; lead_intake_id: string | null; opportunity_id: string | null; potential_id: string | null;
    title: string; status: MyTaskStatus; due_date: string | null; completed_at: string | null;
  }[];
  const followUps = (fuRes.data ?? []) as {
    id: string; customer_id: string; project_id: string | null; note: string;
    due_date: string | null; status: 'open' | 'done'; completed_at: string | null;
  }[];

  const tasks: MyTask[] = [];
  const isSales = SALES_HANDOFF_ROLES.includes(role);
  const oppRole = OPP_TASK_ROLES.includes(role);

  // ── Deal tasks ──
  const uniq = (ids: (string | null)[]) => [...new Set(ids.filter(Boolean))] as string[];
  const oppIds = oppRole ? uniq(leadTasks.map(t => t.opportunity_id)) : [];
  const potIds = oppRole ? uniq(leadTasks.map(t => t.potential_id)) : [];
  const leadIds = SALES_INTAKE_ROLES.includes(role) ? uniq(leadTasks.map(t => t.lead_intake_id)) : [];

  const [opps, pots, leads] = await Promise.all([
    oppIds.length ? admin.from('opportunities').select('id, title, brand').in('id', oppIds).is('deleted_at', null) : { data: [] },
    potIds.length ? admin.from('prospect_potentials').select('id, title').in('id', potIds).is('deleted_at', null) : { data: [] },
    leadIds.length ? admin.from('lead_intake').select('id, customer_name, brand').in('id', leadIds).is('deleted_at', null) : { data: [] },
  ]);
  // Same checks the deal pages and task APIs run (region, owner, assignee): read to list it,
  // write to change it.
  const access = async (ids: string[], check: (id: string, mode: 'read' | 'write') => Promise<boolean>) =>
    new Map(await Promise.all(ids.map(async id => [id, { read: await check(id, 'read'), write: await check(id, 'write') }] as const)));
  const oppById = new Map(((opps.data ?? []) as { id: string; title: string | null; brand: string | null }[]).map(o => [o.id, o]));
  const potById = new Map(((pots.data ?? []) as { id: string; title: string | null }[]).map(p => [p.id, p]));
  const leadById = new Map(((leads.data ?? []) as { id: string; customer_name: string | null; brand: string | null }[]).map(l => [l.id, l]));
  const [oppAccess, potAccess] = await Promise.all([
    access([...oppById.keys()], (id, mode) => canAccessOpportunity(admin, id, userId, role, mode)),
    access([...potById.keys()], (id, mode) => canAccessPotential(admin, id, userId, role, mode)),
  ]);

  for (const t of leadTasks) {
    const base = { id: t.id, title: t.title, status: t.status, dueDate: t.due_date?.slice(0, 10) ?? null, completedAt: t.completed_at, project: null };
    if (t.opportunity_id) {
      const o = oppById.get(t.opportunity_id);
      const ok = oppAccess.get(t.opportunity_id);
      if (!o || !ok?.read) continue;
      tasks.push({
        ...base, source: isSales ? 'sales' : 'marketing',
        record: {
          label: name(o.title, o.brand) || 'Untitled opportunity',
          // Sales opens the deal on its CRM board; Marketing in its Potentials view.
          href: isSales ? `/leads?open=${o.id}` : quickViewLink('opportunity', o.id),
        },
        statusApi: ok.write ? { kind: 'lead', url: `/api/marketing/opportunities/${o.id}/tasks/${t.id}` } : null,
      });
    } else if (t.potential_id) {
      const p = potById.get(t.potential_id);
      const ok = potAccess.get(t.potential_id);
      if (!p || !ok?.read) continue;
      tasks.push({
        ...base, source: 'marketing',
        record: { label: name(p.title) || 'Untitled potential', href: quickViewLink('potential', p.id) },
        statusApi: ok.write ? { kind: 'lead', url: `/api/marketing/potentials/${p.id}/tasks/${t.id}` } : null,
      });
    } else if (t.lead_intake_id) {
      const l = leadById.get(t.lead_intake_id);
      if (!l) continue;
      tasks.push({
        ...base, source: 'sales',
        record: { label: name(l.customer_name, l.brand) || 'Untitled lead', href: `/leads/${l.id}` },
        statusApi: { kind: 'lead', url: `/api/leads/${l.id}/tasks/${t.id}` },
      });
    }
  }

  // ── Customer follow-ups ── listed for whoever can open Customers; changed by the roles the
  // follow-up API accepts.
  const canEditFollowUps = CUSTOMER_COMMS_WRITE_ROLES.includes(role);
  if (followUps.length && (canEditFollowUps || pageAllowed(role, perms, 'page.customers'))) {
    const projIds = uniq(followUps.map(f => f.project_id));
    const custIds = uniq(followUps.map(f => f.customer_id));
    const [projs, custs] = await Promise.all([
      projIds.length ? admin.from('projects').select('id, code').in('id', projIds) : { data: [] },
      custIds.length ? admin.from('customers').select('id, name').in('id', custIds) : { data: [] },
    ]);
    const projById = new Map(((projs.data ?? []) as { id: string; code: string | null }[]).map(p => [p.id, p]));
    const custById = new Map(((custs.data ?? []) as { id: string; name: string | null }[]).map(c => [c.id, c]));
    for (const f of followUps) {
      const proj = f.project_id ? projById.get(f.project_id) : undefined;
      tasks.push({
        id: f.id, source: 'customers', title: f.note,
        status: f.status === 'done' ? 'done' : 'todo',
        dueDate: f.due_date?.slice(0, 10) ?? null, completedAt: f.completed_at,
        record: proj
          ? { label: proj.code ?? 'Project', href: `/projects/${proj.id}/finalization` }
          : { label: custById.get(f.customer_id)?.name ?? 'Customer', href: `/customers/${f.customer_id}` },
        project: proj ? { id: proj.id, code: proj.code ?? '' } : null,
        statusApi: canEditFollowUps ? { kind: 'follow_up', url: `/api/customers/${f.customer_id}/follow-ups/${f.id}` } : null,
      });
    }
  }

  return tasks;
}
