import { describe, it, expect } from 'vitest';
import {
  assemblePortfolio, blockerRollup, workload, isMyAction,
  type PortfolioSources, type PortfolioProject,
} from '@/lib/workspace/portfolio';

const project = (o: Partial<PortfolioProject> = {}): PortfolioProject => ({
  id: 'p1', code: 'STW 1', name: 'Test', is_draft: false,
  delivered_to_trust_at: '2026-01-01', current_stage: 'production',
  customer_id: null, tlines_pm_id: null, trustlines_pm_id: null, pm_supervisor_id: null,
  prod_pm_ms_id: null, prod_pm_ci_id: null,
  ...o,
});

const sources = (projects: PortfolioProject[], o: Partial<PortfolioSources> = {}): PortfolioSources => ({
  projects,
  designJobsByProject: new Map(),
  handoverByProject: new Map(),
  siteByProject: new Map(),
  changeRequestsByProject: new Map(),
  itemsByProject: new Map(),
  approvalsByProject: new Map(),
  planByProject: new Map(),
  followUpsByProject: new Map(),
  now: '2026-07-16',
  ...o,
});

const vendorlessItem = { id: 'i1', type: 'Millwork', status: 'NOT_ORDERED', hasVendor: false, poSignStatus: 'NOT_SIGNED', pfSignStatus: 'NOT_SIGNED', targetDate: null };
const handedOver = (ids: string[]) => new Map(ids.map(id => [id, { status: 'complete' }]));

describe('assemblePortfolio', () => {
  it('returns one entry per project', () => {
    const out = assemblePortfolio(sources([project({ id: 'a' }), project({ id: 'b' })]), { userId: 'u1', role: 'ops_manager' });
    expect(out.map(e => e.project.id)).toEqual(['a', 'b']);
  });

  it('derives blockers via the lifecycle engine (same truth as the cockpit)', () => {
    const out = assemblePortfolio(
      sources([project()], { itemsByProject: new Map([['p1', [vendorlessItem]]]), handoverByProject: handedOver(['p1']) }),
      { userId: 'u1', role: 'ops_manager' },
    );
    expect(out[0].blockers.some(b => b.code === 'vendor_unassigned')).toBe(true);
  });

  it('REDACTS internal blockers for a tlines_pm', () => {
    const src = sources([project()], { itemsByProject: new Map([['p1', [vendorlessItem]]]), handoverByProject: handedOver(['p1']) });
    const internal = assemblePortfolio(src, { userId: 'u1', role: 'trustlines_pm' });
    const external = assemblePortfolio(src, { userId: 'u1', role: 'tlines_pm' });

    expect(internal[0].blockers.some(b => b.code === 'vendor_unassigned')).toBe(true);
    expect(external[0].blockers.some(b => b.code === 'vendor_unassigned')).toBe(false);
  });

  it('never leaks an internal ACTION to a tlines_pm either', () => {
    const out = assemblePortfolio(
      sources([project()], { itemsByProject: new Map([['p1', [vendorlessItem]]]), handoverByProject: handedOver(['p1']) }),
      { userId: 'u1', role: 'tlines_pm' },
    );
    const text = JSON.stringify(out[0].allActions).toLowerCase();
    expect(text).not.toContain('vendor');
  });

  it('counts pending work per project', () => {
    const out = assemblePortfolio(sources([project()], {
      approvalsByProject: new Map([['p1', [{ doc_type: 'pf' }, { doc_type: 'po_bo' }]]]),
      changeRequestsByProject: new Map([['p1', [{ status: 'open' }, { status: 'approved' }]]]),
      followUpsByProject: new Map([['p1', [
        { status: 'open', due_date: '2026-07-01' },
        { status: 'open', due_date: '2026-08-01' },
        { status: 'done', due_date: '2026-01-01' },
      ]]]),
    }), { userId: 'u1', role: 'ops_manager' });

    expect(out[0].pending).toEqual({ openApprovals: 2, openChangeRequests: 1, overdueFollowUps: 1 });
  });

  it('handles an empty portfolio', () => {
    expect(assemblePortfolio(sources([]), { userId: 'u1', role: 'ops_manager' })).toEqual([]);
  });
});

describe('isMyAction', () => {
  const p = project({ tlines_pm_id: 'tlines-guy', trustlines_pm_id: 'trust-guy' });

  it('a project_pm action is mine only when that slot names ME', () => {
    const owner = { kind: 'project_pm', slot: 'tlines_pm_id' } as const;
    expect(isMyAction(owner, p, { userId: 'tlines-guy', role: 'tlines_pm' })).toBe(true);
    expect(isMyAction(owner, p, { userId: 'someone-else', role: 'tlines_pm' })).toBe(false);
  });

  it('distinguishes the two PM slots on the same project', () => {
    expect(isMyAction({ kind: 'project_pm', slot: 'trustlines_pm_id' }, p, { userId: 'trust-guy', role: 'trustlines_pm' })).toBe(true);
    expect(isMyAction({ kind: 'project_pm', slot: 'trustlines_pm_id' }, p, { userId: 'tlines-guy', role: 'tlines_pm' })).toBe(false);
  });

  it('a role action is mine when the role matches', () => {
    expect(isMyAction({ kind: 'role', role: 'production_manager' }, p, { userId: 'x', role: 'production_manager' })).toBe(true);
    expect(isMyAction({ kind: 'role', role: 'production_manager' }, p, { userId: 'x', role: 'tlines_pm' })).toBe(false);
  });

  it('fails closed with no user / no role', () => {
    expect(isMyAction({ kind: 'project_pm', slot: 'tlines_pm_id' }, p, { userId: null, role: 'tlines_pm' })).toBe(false);
    expect(isMyAction({ kind: 'role', role: 'ops_manager' }, p, { userId: 'x', role: null })).toBe(false);
  });
});

describe('blockerRollup', () => {
  it('counts PROJECTS per blocker, not rows', () => {
    const entries = assemblePortfolio(sources(
      [project({ id: 'a' }), project({ id: 'b' })],
      { handoverByProject: handedOver(['a', 'b']),
        itemsByProject: new Map([
        ['a', [vendorlessItem, { ...vendorlessItem, id: 'i2', type: 'Ceiling' }]],
        ['b', [vendorlessItem]],
      ]) },
    ), { userId: 'u', role: 'ops_manager' });

    const roll = blockerRollup(entries);
    expect(roll.find(r => r.code === 'vendor_unassigned')?.projects).toBe(2);
  });

  it('ignores stage_mismatch — bookkeeping, not real work', () => {
    const entries = assemblePortfolio(sources([project({ current_stage: 'closed_deal' })]), { userId: 'u', role: 'ops_manager' });
    expect(blockerRollup(entries).some(r => r.code === 'stage_mismatch')).toBe(false);
  });

  it('sorts the worst blocker first', () => {
    const entries = assemblePortfolio(sources(
      [project({ id: 'a' }), project({ id: 'b' })],
      { itemsByProject: new Map([['a', [vendorlessItem]], ['b', [vendorlessItem]]]),
        handoverByProject: new Map([['a', { status: 'complete' }], ['b', { status: 'in_progress' }]]) },
    ), { userId: 'u', role: 'ops_manager' });

    const roll = blockerRollup(entries);
    expect(roll[0].projects).toBeGreaterThanOrEqual(roll[roll.length - 1].projects);
  });

  it('is empty when nothing is blocked', () => {
    expect(blockerRollup([])).toEqual([]);
  });
});

describe('workload', () => {
  it('counts projects per PM', () => {
    const entries = assemblePortfolio(sources([
      project({ id: 'a', tlines_pm_id: 'u1' }),
      project({ id: 'b', tlines_pm_id: 'u1' }),
      project({ id: 'c', tlines_pm_id: 'u2' }),
    ]), { userId: 'x', role: 'ops_manager' });

    const w = workload(entries);
    expect(w.find(x => x.userId === 'u1')?.projects).toBe(2);
    expect(w.find(x => x.userId === 'u2')?.projects).toBe(1);
  });

  it('counts a person ONCE per project even when they hold two slots on it', () => {
    const entries = assemblePortfolio(sources([
      project({ id: 'a', tlines_pm_id: 'u1', trustlines_pm_id: 'u1', pm_supervisor_id: 'u1' }),
    ]), { userId: 'x', role: 'ops_manager' });

    expect(workload(entries).find(x => x.userId === 'u1')?.projects).toBe(1);
  });

  it('marks how many of a person\'s projects are blocked', () => {
    const doneItem = { id: 'i9', type: 'Millwork', status: 'SENT', hasVendor: true, poSignStatus: 'SIGNED', pfSignStatus: 'SIGNED', targetDate: null };
    const entries = assemblePortfolio(sources(
      [project({ id: 'a', tlines_pm_id: 'u1' }), project({ id: 'b', tlines_pm_id: 'u1', current_stage: 'delivered' })],
      { handoverByProject: handedOver(['a', 'b']),
        siteByProject: new Map([['b', { overall_status: 'ready' }]]),
        planByProject: new Map([['b', { status: 'delivered', customer_accepted: true }]]),
        itemsByProject: new Map([['a', [vendorlessItem]], ['b', [doneItem]]]) },
    ), { userId: 'x', role: 'ops_manager' });

    const u1 = workload(entries).find(x => x.userId === 'u1');
    expect(u1?.projects).toBe(2);
    expect(u1?.blocked).toBe(1);
  });

  it('ignores unassigned projects rather than inventing a PM', () => {
    const entries = assemblePortfolio(sources([project()]), { userId: 'x', role: 'ops_manager' });
    expect(workload(entries)).toEqual([]);
  });
});
