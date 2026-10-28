
import type { PortfolioEntry } from './portfolio';
import { TYPE_SUB_PHASE_LABELS } from '@/lib/lifecycle/projectLifecycle';

export interface PortfolioRow {
  projectId: string;
  code: string | null;
  name: string | null;
  phaseLabel: string;
  /** Raw lifecycle phase key (e.g. PRODUCTION_LOGISTICS) — for grouping/counting by phase. */
  phase: string;
  /** Per-type target dates (only types that have one) — the PM workspace's deadlines/milestones. */
  deadlines: { type: string; stage: string; targetDate: string; isOverdue: boolean }[];
  blockers: { code: string; message: string }[];
  myActions: { code: string; action: string; href: string; priority: number }[];
  pending: { openApprovals: number; openChangeRequests: number; overdueFollowUps: number };
}

export function toRows(entries: PortfolioEntry[], phaseLabels: Record<string, string>): PortfolioRow[] {
  return entries.map(e => ({
    projectId: e.project.id,
    code: e.project.code,
    name: e.project.name,
    phaseLabel: phaseLabels[e.lifecycle.phase] ?? e.lifecycle.phase,
    phase: e.lifecycle.phase,
    deadlines: e.lifecycle.perType
      .filter(t => !!t.targetDate)
      .map(t => ({ type: t.type, stage: TYPE_SUB_PHASE_LABELS[t.subPhase] ?? t.subPhase, targetDate: t.targetDate as string, isOverdue: t.isOverdue }))
      .sort((a, b) => a.targetDate.localeCompare(b.targetDate)),
    blockers: e.blockers.filter(b => b.code !== 'stage_mismatch').map(b => ({ code: b.code, message: b.message })),
    // priority carried through — nextActions.ts already ranks urgency (e.g. an open handover
    // outranks a missing designer); dropping it here meant the PM workspace could only ever sort
    // by "has an action or not," never by which action is actually most urgent (Roadmap Month 2,
    // task 17).
    myActions: e.myActions.map(a => ({ code: a.code, action: a.action, href: a.href, priority: a.priority })),
    pending: e.pending,
  }));
}
