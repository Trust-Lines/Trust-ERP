
import type { PortfolioEntry } from './portfolio';

export interface PortfolioRow {
  projectId: string;
  code: string | null;
  name: string | null;
  phaseLabel: string;
  blockers: { code: string; message: string }[];
  myActions: { code: string; action: string; href: string }[];
  pending: { openApprovals: number; openChangeRequests: number; overdueFollowUps: number };
}

export function toRows(entries: PortfolioEntry[], phaseLabels: Record<string, string>): PortfolioRow[] {
  return entries.map(e => ({
    projectId: e.project.id,
    code: e.project.code,
    name: e.project.name,
    phaseLabel: phaseLabels[e.lifecycle.phase] ?? e.lifecycle.phase,
    blockers: e.blockers.filter(b => b.code !== 'stage_mismatch').map(b => ({ code: b.code, message: b.message })),
    myActions: e.myActions.map(a => ({ code: a.code, action: a.action, href: a.href })),
    pending: e.pending,
  }));
}
