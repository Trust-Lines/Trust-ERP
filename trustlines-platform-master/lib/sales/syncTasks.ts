// Keeps the Sales task list in step with the pipeline: every open Opportunity gets the to-dos its
// stage calls for (lib/sales/taskRules.ts) — "proposal sent -> follow up, what was their answer?",
// "client asked for changes -> send the revised proposal", "waiting -> check in", ...
//
// Idempotent and safe to call as often as you like (page load, stage change, cron):
//  - A task is identified by (opportunity, title). If one already exists — open OR done — nothing is
//    created, so finishing a task never brings it back; only a new stage brings new tasks.
//  - When a deal leaves a stage, that stage's auto task is removed if nobody started it (status
//    'todo'); anything In Progress or Done is kept as history.
//  - Tasks go to the deal's Sales owner, or stay unassigned (shared pool) — never auto-assigned to
//    whoever happened to trigger the sync.
import { fetchInChunks } from '@/lib/supabase/chunkedIn';
import { AUTO_TASK_STAGE_BY_TITLE, OPEN_TASK_STAGES, tasksForOpportunity, type OppForTasks } from './taskRules';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface SyncResult { considered: number; created: number; retired: number }

const OPP_COLS = 'id, stage, sales_owner_id, estimated_value, next_action_date';
const PAGE = 1000; // PostgREST caps a select at 1000 rows

export async function syncSalesTasks(admin: any, opts: { opportunityId?: string; today?: string } = {}): Promise<SyncResult> {
  const today = opts.today ?? new Date().toISOString().slice(0, 10);

  // 1. open deals that should have tasks
  const open: OppForTasks[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = admin.from('opportunities').select(OPP_COLS).is('deleted_at', null).in('stage', OPEN_TASK_STAGES).range(from, from + PAGE - 1);
    if (opts.opportunityId) q = q.eq('id', opts.opportunityId);
    const { data, error } = await q;
    if (error) throw new Error(`opportunities: ${error.message}`);
    open.push(...((data ?? []) as OppForTasks[]));
    if (!data || data.length < PAGE) break;
  }

  // 2. auto tasks that already exist (any status), for open deals AND for deals that moved on
  const titles = [...AUTO_TASK_STAGE_BY_TITLE.keys()];
  const existing: { id: string; opportunity_id: string; title: string; status: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = admin.from('lead_tasks').select('id, opportunity_id, title, status').not('opportunity_id', 'is', null).in('title', titles).range(from, from + PAGE - 1);
    if (opts.opportunityId) q = q.eq('opportunity_id', opts.opportunityId);
    const { data, error } = await q;
    if (error) throw new Error(`lead_tasks: ${error.message}`);
    existing.push(...((data ?? []) as typeof existing));
    if (!data || data.length < PAGE) break;
  }

  // 3. create what's missing
  const haveByOpp = new Map<string, Set<string>>();
  for (const t of existing) {
    if (!haveByOpp.has(t.opportunity_id)) haveByOpp.set(t.opportunity_id, new Set());
    haveByOpp.get(t.opportunity_id)!.add(t.title);
  }
  const toInsert: Record<string, unknown>[] = [];
  for (const opp of open) {
    const have = haveByOpp.get(opp.id);
    for (const spec of tasksForOpportunity(opp, today)) {
      if (have?.has(spec.title)) continue;
      toInsert.push({ opportunity_id: opp.id, title: spec.title, status: 'todo', assignee_id: spec.assignee_id, due_date: spec.due_date });
    }
  }
  for (let i = 0; i < toInsert.length; i += 200) {
    const { error } = await admin.from('lead_tasks').insert(toInsert.slice(i, i + 200));
    if (error) throw new Error(`insert tasks: ${error.message}`);
  }

  // 4. retire untouched auto tasks whose stage the deal has left
  const stageByOpp = new Map<string, string>(open.map(o => [o.id, o.stage]));
  const notOpen = [...new Set(existing.map(t => t.opportunity_id).filter(id => !stageByOpp.has(id)))];
  const others = await fetchInChunks(notOpen, chunk =>
    admin.from('opportunities').select('id, stage, deleted_at').in('id', chunk));
  for (const o of others as { id: string; stage: string; deleted_at: string | null }[]) {
    if (!o.deleted_at) stageByOpp.set(o.id, o.stage);
  }
  const retireIds = existing
    .filter(t => t.status === 'todo' && stageByOpp.get(t.opportunity_id) !== AUTO_TASK_STAGE_BY_TITLE.get(t.title))
    .map(t => t.id);
  for (let i = 0; i < retireIds.length; i += 150) {
    const { error } = await admin.from('lead_tasks').delete().in('id', retireIds.slice(i, i + 150));
    if (error) throw new Error(`retire tasks: ${error.message}`);
  }

  return { considered: open.length, created: toInsert.length, retired: retireIds.length };
}
