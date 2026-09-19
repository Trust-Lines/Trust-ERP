// "How has this deal progressed, and what happened?" — everything the Progress pop-up shows,
// gathered in one place: the milestones (created / handed off / accepted / project opened /
// closed), the change log (stage moves with reasons, task completions), the design job, and the
// comment thread (for ClickUp-imported deals the comments ARE the history).
import { STAGE_LABELS } from '@/lib/workflow/machine';
import type { OpportunityStage, ProjectStage } from '@/types/database';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const DESIGN_STATUS_LABEL: Record<string, string> = {
  awaiting_assignment: 'Awaiting a designer', assigned: 'Assigned, not started', working_on_it: 'In progress',
  ready_for_sales_review: 'Ready for your review', revision_requested: 'Revision requested',
  approved_by_sales: 'Approved', presented_to_customer: 'Presented to customer', completed: 'Completed', cancelled: 'Cancelled',
};

/** The path a deal walks, left to right. */
export const PROGRESS_STEPS = [
  { key: 'handoff', label: 'Sales handoff' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'working', label: 'Design / Trust Lines working' },
  { key: 'proposal', label: 'Proposal sent' },
  { key: 'negotiation', label: 'Changes / negotiation' },
  { key: 'closed', label: 'Closed' },
] as const;

/** Which step a stage sits on (-1 = still with Marketing). */
export function stageStep(stage: OpportunityStage): number {
  switch (stage) {
    case 'sales_handoff': return 0;
    case 'sales_accepted': return 1;
    case 'discovery': case 'sales_design': case 'working_on_it_trust': return 2;
    case 'proposal': return 3;
    case 'negotiation': return 4;
    case 'closed_won': case 'closed_lost': return 5;
    case 'on_hold': return -2; // "Waiting" — the client's turn; not a position on the path
    default: return -1;
  }
}

export interface TimelineEvent {
  at: string;
  type: 'milestone' | 'change' | 'comment' | 'project' | 'design';
  text: string;
  by: string | null;
  detail: string | null;
}

export interface DealProgress {
  events: TimelineEvent[];
  project: { code: string; stage: ProjectStage | null; stageLabel: string | null; createdAt: string | null } | null;
  designJob: { status: string; statusLabel: string; designerName: string | null; updatedAt: string } | null;
  /** Newest real event (comment / change / milestone). */
  lastActivityAt: string | null;
}

interface OppIn {
  stage: OpportunityStage; created_at: string; external_created_at: string | null;
  sales_handoff_at: string | null; sales_accepted_at: string | null;
  closed_at: string | null; closed_reason: string | null; return_reason: string | null; updated_at: string;
}
interface ProjectIn { code: string; current_stage: ProjectStage | null; created_at: string | null }
interface NoteIn { author_name: string | null; body: string; source_created_at: string | null; created_at: string }
interface ActivityIn { actor_id: string | null; kind: string; body: string; created_at: string }
interface JobIn { status: string; assigned_designer_id: string | null; created_at: string; updated_at: string }

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

export function buildDealProgress(input: {
  opp: OppIn; project: ProjectIn | null; notes: NoteIn[]; activity: ActivityIn[];
  job: JobIn | null; names: Record<string, string>;
}): DealProgress {
  const { opp, project, notes, activity, job, names } = input;
  const events: TimelineEvent[] = [];
  const add = (at: string | null | undefined, type: TimelineEvent['type'], text: string, by: string | null = null, detail: string | null = null) => {
    if (at && !Number.isNaN(Date.parse(at))) events.push({ at, type, text, by, detail });
  };

  add(opp.external_created_at ?? opp.created_at, 'milestone', opp.external_created_at ? 'Deal created in ClickUp' : 'Deal created');
  add(opp.sales_handoff_at, 'milestone', 'Handed off to Sales');
  add(opp.sales_accepted_at, 'milestone', 'Accepted by Sales');
  if (opp.stage === 'marketing_qualification' && opp.return_reason) add(opp.updated_at, 'milestone', 'Returned to Marketing', null, opp.return_reason);
  if (project) add(project.created_at, 'project', `Project ${project.code} opened`);
  if (job) {
    add(job.created_at, 'design', 'Design job started', job.assigned_designer_id ? names[job.assigned_designer_id] ?? null : null);
    if (Date.parse(job.updated_at) - Date.parse(job.created_at) > 60_000) {
      add(job.updated_at, 'design', `Design: ${DESIGN_STATUS_LABEL[job.status] ?? job.status}`);
    }
  }
  if (opp.stage === 'closed_won' || opp.stage === 'closed_lost') {
    // ClickUp imports fell back to "now" when a task had no Date done, so a closed_at that lands right
    // on the import moment (created_at) isn't a real closing date — skip it rather than show today.
    const importFallback = !!opp.external_created_at && opp.closed_at != null
      && Math.abs(Date.parse(opp.closed_at) - Date.parse(opp.created_at)) < 10 * 60_000;
    // The import also stored ClickUp's label ("DEAL CLOSED") as the reason — that's not a reason.
    const reason = opp.closed_reason && !/^deal (closed|missed)$/i.test(opp.closed_reason.trim()) ? opp.closed_reason : null;
    if (!importFallback) add(opp.closed_at, 'milestone', opp.stage === 'closed_won' ? 'Closed — won' : 'Closed — lost', null, reason);
  }
  for (const a of activity) add(a.created_at, a.kind === 'comment' ? 'comment' : 'change', a.body, a.actor_id ? names[a.actor_id] ?? null : null);
  for (const n of notes) add(n.source_created_at ?? n.created_at, 'comment', 'Comment', n.author_name, clip(n.body.replace(/\s+/g, ' ').trim(), 220));

  events.sort((x, y) => Date.parse(y.at) - Date.parse(x.at)); // newest first

  return {
    events: events.slice(0, 300),
    project: project ? {
      code: project.code, stage: project.current_stage,
      stageLabel: project.current_stage ? STAGE_LABELS[project.current_stage] ?? project.current_stage : null,
      createdAt: project.created_at,
    } : null,
    designJob: job ? {
      status: job.status, statusLabel: DESIGN_STATUS_LABEL[job.status] ?? job.status,
      designerName: job.assigned_designer_id ? names[job.assigned_designer_id] ?? null : null, updatedAt: job.updated_at,
    } : null,
    lastActivityAt: events[0]?.at ?? null,
  };
}

/** Fetches what the builder needs and builds it. */
export async function loadDealProgress(admin: any, opp: OppIn & { id: string }, project: ProjectIn | null, notes: NoteIn[]): Promise<DealProgress> {
  const [actRes, jobRes] = await Promise.all([
    admin.from('lead_activity').select('actor_id, kind, body, created_at').eq('opportunity_id', opp.id).order('created_at', { ascending: false }).limit(200),
    admin.from('sales_design_jobs').select('status, assigned_designer_id, created_at, updated_at')
      .eq('opportunity_id', opp.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(1),
  ]);
  const activity = (actRes.data ?? []) as ActivityIn[];
  const job = ((jobRes.data ?? []) as JobIn[])[0] ?? null;

  const personIds = [...new Set([...activity.map(a => a.actor_id), job?.assigned_designer_id].filter(Boolean))] as string[];
  const names: Record<string, string> = {};
  if (personIds.length) {
    const { data: people } = await admin.from('profiles').select('id, full_name').in('id', personIds);
    for (const p of (people ?? []) as { id: string; full_name: string }[]) names[p.id] = p.full_name;
  }
  return buildDealProgress({ opp, project, notes, activity, job, names });
}
