
import type { PortfolioEntry } from './portfolio';

export interface PortfolioRow {
  projectId: string;
  code: string | null;
  name: string | null;
  phaseLabel: string;
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
    blockers: e.blockers.filter(b => b.code !== 'stage_mismatch').map(b => ({ code: b.code, message: b.message })),
    // priority carried through — nextActions.ts already ranks urgency (e.g. an open handover
    // outranks a missing designer); dropping it here meant the PM workspace could only ever sort
    // by "has an action or not," never by which action is actually most urgent (Roadmap Month 2,
    // task 17).
    myActions: e.myActions.map(a => ({ code: a.code, action: a.action, href: a.href, priority: a.priority })),
    pending: e.pending,
  }));
}
