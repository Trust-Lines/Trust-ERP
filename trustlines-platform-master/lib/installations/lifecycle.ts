// Installation Plan → Gantt (Figma 784:18261): each project's life drawn as dated stages.
//
// Only stages the platform has real dates for are drawn — nothing is guessed:
//   Opportunity              opportunity created → deal closed (projects.closed_deal_date)
//   Production in Progress   first item ordered (production_items.std) → next milestone
//   Ready to Receive         first RTR → next milestone
//   Ready                    first RDY (else RTD, received) → next milestone
//   Shipped                  container date (else FTD / SND, sent) → installation start
//   Installation             installations.planned_start → planned_finish
//   Completed                installation status "Completed", at planned_finish
// The design / sales stages (Queued, Initial Design, Modification, Negotiation, Finalization,
// Technical, To Order, Assembly) have no stored start / end dates yet, so they are not drawn.
// Browser-safe: pure functions, no I/O.

export type LifeStage = 'opportunity' | 'production' | 'ready_to_receive' | 'ready' | 'shipped' | 'installation' | 'completed';

/** Label and board colour token (globals.css --board-{tone}-fg / -bg) for each stage. */
export const LIFE_STAGE: Record<LifeStage, { label: string; tone: string }> = {
  opportunity:      { label: 'Opportunity',            tone: 'opportunity' },
  production:       { label: 'Production in Progress', tone: 'production' },
  ready_to_receive: { label: 'Ready to Receive',       tone: 'ready' },
  ready:            { label: 'Ready',                  tone: 'ready' },
  shipped:          { label: 'Shipped',                tone: 'shipped' },
  installation:     { label: 'Installation',           tone: 'installation' },
  completed:        { label: 'Completed',              tone: 'completed' },
};

/** Earliest date of each milestone for one project (yyyy-mm-dd), null when unknown. */
export interface ProjectMilestones {
  opportunityAt: string | null;
  dealClosedAt: string | null;
  ordered: string | null;
  readyToReceive: string | null;
  received: string | null;
  ready: string | null;
  sent: string | null;
  shipped: string | null;
}

export interface MilestoneItem {
  std: string | null; rtr: string | null; rtd: string | null; rdy: string | null;
  ftd: string | null; snd: string | null; container_date: string | null;
}

const day = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const min = (xs: (string | null | undefined)[]) => xs.map(day).filter((x): x is string => !!x).sort()[0] ?? null;
const max = (xs: (string | null | undefined)[]) => xs.map(day).filter((x): x is string => !!x).sort().at(-1) ?? null;

export function milestonesFrom(
  items: MilestoneItem[],
  opportunityCreated: (string | null)[],
  dealClosedAt: string | null,
): ProjectMilestones {
  return {
    opportunityAt: min(opportunityCreated),
    dealClosedAt: day(dealClosedAt),
    ordered: min(items.map(i => i.std)),
    readyToReceive: min(items.map(i => i.rtr)),
    received: min(items.map(i => i.rtd)),
    ready: min(items.map(i => i.rdy)),
    sent: min(items.flatMap(i => [i.ftd, i.snd])),
    // The last container to leave is when the whole order is on its way.
    shipped: max(items.map(i => i.container_date)),
  };
}

export interface LifeSegment {
  stage: LifeStage;
  start: string;
  end: string;
  /** Still running: no later milestone yet, so it ends today. */
  open: boolean;
}

export interface InstallDates { planned_start: string | null; planned_finish: string | null; status: string | null }

/**
 * Dated stages, oldest first. A stage runs from its own date to the next stage's date; the
 * newest one runs to today (open) when it has started, else it is a one-day marker. Dates that
 * arrive out of order are clamped so segments never run backwards.
 */
export function lifecycleSegments(m: ProjectMilestones | null, install: InstallDates, today: string): LifeSegment[] {
  const points: { stage: LifeStage; at: string; end?: string | null }[] = [];
  const push = (stage: LifeStage, at: string | null, end?: string | null) => { if (at) points.push({ stage, at, end }); };
  if (m) {
    push('opportunity', m.opportunityAt, m.dealClosedAt);
    push('production', m.ordered);
    push('ready_to_receive', m.readyToReceive);
    push('ready', m.ready ?? m.received);
    push('shipped', m.shipped ?? m.sent);
  }
  const start = day(install.planned_start);
  const finish = day(install.planned_finish) ?? start;
  push('installation', start, finish);
  if (install.status === 'Completed' && finish) push('completed', finish, finish);

  // Never earlier than the stage before it.
  for (let i = 1; i < points.length; i++) if (points[i].at < points[i - 1].at) points[i].at = points[i - 1].at;

  return points.map((p, i) => {
    const next = points[i + 1]?.at ?? null;
    let end = p.end && p.end >= p.at ? p.end : next;
    if (end && next && end > next) end = next;
    const open = !end;
    if (!end) end = p.at <= today ? today : p.at;
    return { stage: p.stage, start: p.at, end, open };
  });
}

/** The stage the project is in today: the newest stage that has started (Completed wins). */
export function currentStage(segments: LifeSegment[], today: string): LifeStage | null {
  if (segments.some(s => s.stage === 'completed')) return 'completed';
  const started = segments.filter(s => s.start <= today);
  return started.at(-1)?.stage ?? null;
}
