import { describe, it, expect } from 'vitest';
import { isOnProject, withLiveStatus, type LiveContext } from '@/lib/workspace/live';
import type { PortfolioRow } from '@/lib/workspace/rows';
import type { TrustProject } from '@/lib/trust/board';
import type { Installation } from '@/lib/installations/compute';

const TODAY = '2026-11-09';
const row = (code: string): PortfolioRow => ({
  projectId: code, code, name: code, phase: 'CLOSED_DEAL', phaseLabel: 'Closed Deal', deadlines: [],
  blockers: [{ code: 'handover_missing', message: 'No handover record yet' }, { code: 'approvals_pending', message: '1 approval awaiting signature' }],
  myActions: [{ code: 'handover_missing', action: 'Start handover', href: '#', priority: 9 }],
  pending: { openApprovals: 1, openChangeRequests: 0, overdueFollowUps: 0 },
});
const trust = (no: string, statuses: string[], status = 'PRE_PROJECT'): TrustProject => ({
  id: `t${no}`, projectNo: no, name: no, address: null, bucket: 'TLINES_NE', status, types: null, createdAt: '2026-10-01', deletedAt: null,
  items: statuses.map(s => ({ type: 'MILLWORK', status: s, pfCode: null, containerNo: null, containerDate: null })),
});
const install = (p: Partial<Installation>): Installation => ({
  id: 'i', project_no: null, project_name: null, branch: null, city_state: null, planned_start: null, planned_finish: null, team: null,
  team_size: null, scope: null, pm_name: null, confidence: null, status: null, blockers: null, notes: null, sort_order: 0, updated_at: '', ...p,
});
const ctx = (over: Partial<LiveContext>): LiveContext => ({
  trustByNo: new Map(), installsByNo: new Map(), peopleByNo: new Map(), installPmByNo: new Map(), trustError: null, ...over,
});

describe('workspace rows from the live sources', () => {
  it('takes the stage from the Trust System and drops the internal hand-off blockers', () => {
    const [r] = withLiveStatus([row('STNE 409')], ctx({ trustByNo: new Map([['409', trust('409', ['ORDERED'])]]) }), TODAY);
    expect(r.phase).toBe('PRODUCTION_LOGISTICS');
    expect(r.phaseLabel).toBe('Production In Progress');
    expect(r.blockers.map(b => b.code)).toEqual(['approvals_pending']);
    expect(r.myActions).toEqual([]);
  });

  it('flags types on hold in Trust and installation problems', () => {
    const installs = [install({ project_no: '#480 STG 1', planned_start: '2026-10-01', planned_finish: '2026-11-01' })];
    const [r] = withLiveStatus([row('PSNW 480')], ctx({
      trustByNo: new Map([['480', trust('480', ['HOLD_T'])]]), installsByNo: new Map([['480', installs]]),
    }), TODAY);
    expect(r.phase).toBe('DELIVERY_BUILD');
    expect(r.blockers.map(b => b.message)).toEqual(expect.arrayContaining(['Millwork on hold (Trust)', 'Installation #480 STG 1: Overdue - past finish date']));
  });

  it('leaves projects the live sources don’t know alone', () => {
    const before = row('STNW EX-5');
    expect(withLiveStatus([before], ctx({}), TODAY)[0]).toBe(before);
  });

  it('finds a PM by board pick or installation PM name', () => {
    const c = ctx({ peopleByNo: new Map([['409', new Set(['u1'])]]), installPmByNo: new Map([['501', new Set(['morry'])]]) });
    expect(isOnProject('STNE 409', 'u1', null, c)).toBe(true);
    expect(isOnProject('STSE 501', 'u2', 'Morry Smith', c)).toBe(true);
    expect(isOnProject('STSE 501', 'u2', 'Hashem', c)).toBe(false);
  });
});
