import { describe, it, expect } from 'vitest';
import { isOnProject, liveKey, trustKeyFor, withLiveStatus, type LiveContext } from '@/lib/workspace/live';
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
    expect(r.blockers.map(b => b.message)).toEqual(expect.arrayContaining(['Millwork on hold by T-Lines', 'Installation #480 STG 1: Overdue - past finish date']));
  });

  it('leaves projects the live sources don’t know alone', () => {
    const before = row('STNW EX-5');
    expect(withLiveStatus([before], ctx({}), TODAY)[0]).toBe(before);
  });

  it('matches Trust numbers that are not just digits', () => {
    const c = ctx({ trustByNo: new Map([
      [liveKey('408 MARKET')!, trust('408 MARKET', ['ORDERED'])],
      [liveKey('408  EXPRESS')!, trust('408  EXPRESS', ['HOLD_T'])],
      [liveKey('EX-5')!, trust('EX-5', [])],
      [liveKey('13P')!, trust('13P', ['ORDERED'])],
    ]) });
    const [market, express, ex5, p13] = withLiveStatus([row('STNW 408 MARKET'), row('STNW 408 EXPRESS'), row('STNW EX-5'), row('STSE 13P')], c, TODAY);
    expect(market.phaseLabel).toBe('Production In Progress');
    expect(express.phaseLabel).not.toBe('Closed Deal');
    // each 408 gets its own Trust project: only EXPRESS has a type on hold
    expect(express.blockers.map(b => b.code)).toContain('items_on_hold');
    expect(market.blockers.map(b => b.code)).not.toContain('items_on_hold');
    expect(ex5.phaseLabel).not.toBe('Closed Deal');
    expect(ex5.blockers.map(b => b.code)).not.toContain('handover_missing');
    expect(p13.phaseLabel).toBe('Production In Progress');
  });

  it('falls back to the number only when one Trust project has it', () => {
    const one = new Map([['500 ST2', 1]]);
    expect(trustKeyFor('STSE 500', one)).toBe('500 ST2');
    const two = new Map([['408 MARKET', 1], ['408 EXPRESS', 1]]);
    expect(trustKeyFor('STNW 408', two)).toBeNull();
    expect(liveKey('STNW 408  MARKET')).toBe('408 MARKET');
    expect(liveKey('EX-5')).toBe('EX 5');
    expect(liveKey('STW 1185')).toBe('1185');
    expect(liveKey('DSNE 466')).toBe('466');
  });

  it('finds a PM by board pick or installation PM name', () => {
    const c = ctx({ peopleByNo: new Map([['409', new Set(['u1'])]]), installPmByNo: new Map([['501', new Set(['morry'])]]) });
    expect(isOnProject('STNE 409', 'u1', null, c)).toBe(true);
    expect(isOnProject('STSE 501', 'u2', 'Morry Smith', c)).toBe(true);
    expect(isOnProject('STSE 501', 'u2', 'Hashem', c)).toBe(false);
  });
});
