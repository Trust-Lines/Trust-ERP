import { describe, it, expect } from 'vitest';
import type { Lead } from '@/components/platform/leads/types';
import {
  pathBuckets, waitingBucket, outcomes, regionRows, closingsByQuarter, hasRealCloseDate, silentDeals, isOpen,
} from '@/lib/sales/dashboardMetrics';

let n = 0;
const lead = (status: Lead['opportunity_status'], extra: Partial<Lead> = {}): Lead => ({
  id: `l${n++}`, name: 'x', industry: '', brand: '', state: '', priority: 'medium', opportunity_status: status, to_do: '', contact: '',
  assignee: '', design_status: '', request: '', project_type: '', location: '', date_created: '2026-01-01T00:00:00Z', source: '', ...extra,
});

describe('stage buckets', () => {
  const leads = [
    lead('ready_to_start'), lead('working_on_it_trust'), lead('working_on_it_trust'),
    lead('design_proposal_sent', { deal_size: 1000 }), lead('contract_stage', { deal_size: 500 }), lead('modification_request'),
    lead('waiting', { deal_size: 200 }), lead('waiting_from_op'), lead('potential'), lead('in_target_list'), lead('deal_closed'), lead('deal_missed'),
  ];

  it('counts each step of the path and rolls contract_stage into "Proposal sent"', () => {
    const b = Object.fromEntries(pathBuckets(leads).map(x => [x.key, x]));
    expect(b.ready.count).toBe(1);
    expect(b.working.count).toBe(2);
    expect(b.proposal).toMatchObject({ count: 2, value: 1500, crmStatus: 'design_proposal_sent' });
    expect(b.changes.count).toBe(1);
    expect(b.new.count).toBe(0);
  });

  it('waiting is its own side-state; potentials and closed deals are not "open"', () => {
    expect(waitingBucket(leads)).toEqual({ count: 2, value: 200 });
    expect(leads.filter(isOpen)).toHaveLength(8);
  });

  it('win rate = won / (won + lost); no decided deals -> null', () => {
    expect(outcomes(leads)).toMatchObject({ won: 1, lost: 1, winRatePct: 50 });
    expect(outcomes([lead('ready_to_start')]).winRatePct).toBeNull();
  });
});

describe('regionRows', () => {
  it('ignores potentials and computes open / proposals / win rate per region', () => {
    const rows = regionRows([
      lead('design_proposal_sent', { region: 'CVW' }), lead('waiting', { region: 'CVW' }), lead('deal_closed', { region: 'CVW', deal_size: 900 }),
      lead('deal_missed', { region: 'CVW' }), lead('deal_missed', { region: 'CVW' }), lead('potential', { region: 'CVW' }),
      lead('deal_closed', { region: 'TLINES_NE' }), lead('ready_to_start'),
    ], c => c === 'CVW' ? 'West' : c);
    const west = rows.find(r => r.region === 'CVW')!;
    expect(west).toMatchObject({ label: 'West', open: 2, proposals: 1, waiting: 1, won: 1, lost: 2, wonValue: 900, winRatePct: 33 });
    expect(rows.find(r => r.region === 'TLINES_NE')).toMatchObject({ won: 1, lost: 0, winRatePct: 100 });
    expect(rows.find(r => r.region === '__none__')).toMatchObject({ label: 'No region', open: 1 });
    expect(rows[0].region).toBe('CVW'); // busiest first
  });
});

describe('closingsByQuarter', () => {
  const r = (won: boolean, closedAt: string | null, extra: Record<string, unknown> = {}) =>
    ({ won, closedAt, createdAt: '2026-09-19T10:00:00Z', imported: true, ...extra });

  it('groups by the quarter a deal closed, fills empty quarters, oldest first', () => {
    const { rows, undated } = closingsByQuarter([
      r(true, '2024-02-10T00:00:00Z'), r(false, '2024-03-30T00:00:00Z'), r(false, '2024-11-01T00:00:00Z'),
    ]);
    expect(undated).toBe(0);
    expect(rows.map(x => [x.label, x.won, x.lost])).toEqual([['Q1 ’24', 1, 1], ['Q2 ’24', 0, 0], ['Q3 ’24', 0, 0], ['Q4 ’24', 0, 1]]);
    expect(rows[0].winRatePct).toBe(50);
    expect(rows[1].winRatePct).toBeNull();
  });

  it('a close date that is really the import moment does not count', () => {
    const fake = r(true, '2026-09-19T10:00:30Z');                       // imported, closed_at ≈ created_at
    const native = r(true, '2026-09-19T10:00:30Z', { imported: false }); // closed today in this app: real
    expect(hasRealCloseDate(fake)).toBe(false);
    expect(hasRealCloseDate(native)).toBe(true);
    expect(hasRealCloseDate(r(true, null))).toBe(false);
    const { rows, undated } = closingsByQuarter([fake, r(false, null), r(true, '2025-05-05T00:00:00Z')]);
    expect(undated).toBe(2);
    expect(rows).toHaveLength(1);
  });

  it('no usable dates -> no rows', () => {
    expect(closingsByQuarter([r(true, null)])).toEqual({ rows: [], undated: 1 });
  });
});

describe('silentDeals', () => {
  const now = new Date('2026-09-19T12:00:00Z');
  const deal = (id: string, createdAt: string) => ({ id, title: id, region: null, stageLabel: 'Proposal', dealSize: null, createdAt });

  it('measures quiet time from the last comment, else from creation; longest quiet first', () => {
    const act = new Map([
      ['a', [{ at: '2026-09-09T00:00:00Z', by: 'Rana', text: 'Sent the revised plans' }, { at: '2026-01-01T00:00:00Z', by: 'Old', text: 'older' }]],
      ['b', []],
    ]);
    const out = silentDeals([deal('a', '2025-01-01T00:00:00Z'), deal('b', '2026-03-01T00:00:00Z'), deal('c', '2026-09-18T00:00:00Z')], act, now);
    expect(out.map(x => [x.id, x.daysSilent])).toEqual([['b', 202], ['a', 10], ['c', 1]]);
    expect(out.find(x => x.id === 'a')).toMatchObject({ lastBy: 'Rana', lastSnippet: 'Sent the revised plans' });
    expect(out.find(x => x.id === 'b')).toMatchObject({ lastBy: null, lastSnippet: null });
  });

  it('a deal whose only activity is older than its own date is measured from its date', () => {
    const out = silentDeals([deal('a', '2026-09-01T00:00:00Z')], new Map([['a', [{ at: '2025-01-01T00:00:00Z', by: 'x', text: 'old' }]]]), now);
    expect(out[0].daysSilent).toBe(18);
  });
});
