// Sales to-do rules: what a salesperson has to DO about an Opportunity, by stage.
// Pure (no I/O) so the rules are easy to read, change and test. lib/sales/syncTasks.ts turns
// them into real `lead_tasks` rows.
import type { OpportunityStage } from '@/types/database';

export interface OppForTasks {
  id: string;
  stage: OpportunityStage;
  sales_owner_id: string | null;
  estimated_value: number | null;
  next_action_date: string | null;
}

export interface TaskSpec {
  title: string;
  due_date: string;           // YYYY-MM-DD
  assignee_id: string | null; // the deal's Sales owner when it has one, otherwise the shared pool
}

interface Rule {
  title: string;
  /** Days from today until it's due. 0 = act now. */
  dueInDays: number;
  /** Extra condition on the deal itself (defaults to always). */
  when?: (o: OppForTasks) => boolean;
}

// One entry per Status OP stage that needs a human. Deal Missed / Deal Closed / Potentials need none.
// A task's identity is (opportunity, title) — see syncTasks.ts — so only rename a title on purpose:
// the old one is retired and the new one created.
export const STAGE_TASK_RULES: Partial<Record<OpportunityStage, Rule[]>> = {
  sales_accepted: [
    { title: 'Ready to start — confirm scope, deposit and schedule with the client', dueInDays: 0 },
  ],
  working_on_it_trust: [
    { title: 'Check design progress with Trust Lines and update the client', dueInDays: 3 },
  ],
  proposal: [
    { title: 'Proposal sent — follow up: what was the client\'s answer?', dueInDays: 0 },
    { title: 'Add the deal size to this opportunity', dueInDays: 2, when: o => o.estimated_value == null },
  ],
  negotiation: [
    { title: 'Client asked for changes — review them and send the revised proposal', dueInDays: 0 },
  ],
  on_hold: [
    { title: 'Waiting on the client — check in and confirm their timing / decision', dueInDays: 7 },
  ],
};

export const OPEN_TASK_STAGES = Object.keys(STAGE_TASK_RULES) as OpportunityStage[];

/** title -> the stage it belongs to. Used to recognise (and retire) auto-generated tasks. */
export const AUTO_TASK_STAGE_BY_TITLE: ReadonlyMap<string, OpportunityStage> = new Map(
  (Object.entries(STAGE_TASK_RULES) as [OpportunityStage, Rule[]][])
    .flatMap(([stage, rules]) => rules.map(r => [r.title, stage] as const)),
);

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Tasks this Opportunity should have right now. `today` is YYYY-MM-DD. */
export function tasksForOpportunity(opp: OppForTasks, today: string): TaskSpec[] {
  const rules = STAGE_TASK_RULES[opp.stage] ?? [];
  return rules
    .filter(r => !r.when || r.when(opp))
    .map(r => ({
      title: r.title,
      // A date the salesperson already set on the deal wins over the rule's default.
      due_date: opp.next_action_date ? opp.next_action_date.slice(0, 10) : addDays(today, r.dueInDays),
      assignee_id: opp.sales_owner_id,
    }));
}
