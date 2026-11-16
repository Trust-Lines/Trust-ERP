import { describe, it, expect } from 'vitest';
import { currentStage, lifecycleSegments, milestonesFrom, undatedStage, type MilestoneItem } from '@/lib/installations/lifecycle';

const TODAY = '2026-11-09';
const item = (p: Partial<MilestoneItem>): MilestoneItem => ({
  std: null, rtr: null, rtd: null, rdy: null, ftd: null, snd: null, container_date: null, ...p,
});
const install = (p: Partial<{ planned_start: string | null; planned_finish: string | null; status: string | null }> = {}) =>
  ({ planned_start: null, planned_finish: null, status: null, ...p });

describe('milestonesFrom', () => {
  it('takes the earliest date per milestone, the last container, and the first opportunity', () => {
    const m = milestonesFrom(
      [item({ std: '2026-08-10', rtr: '2026-09-20', container_date: '2026-10-01' }), item({ std: '2026-08-03', container_date: '2026-10-12T00:00:00Z' })],
      ['2026-06-02T09:00:00Z', '2026-05-20T10:00:00Z'],
      '2026-07-15',
    );
    expect(m).toMatchObject({ opportunityAt: '2026-05-20', dealClosedAt: '2026-07-15', ordered: '2026-08-03', readyToReceive: '2026-09-20', shipped: '2026-10-12' });
  });
});

describe('lifecycleSegments', () => {
  it('chains stages: each runs to the next one, installation to its finish', () => {
    const m = milestonesFrom([item({ std: '2026-08-03', rdy: '2026-09-25', container_date: '2026-10-05' })], ['2026-05-20'], '2026-07-15');
    const segs = lifecycleSegments(m, install({ planned_start: '2026-10-20', planned_finish: '2026-10-30' }), TODAY);
    expect(segs.map(s => [s.stage, s.start, s.end, s.open])).toEqual([
      ['opportunity', '2026-05-20', '2026-07-15', false],
      ['production', '2026-08-03', '2026-09-25', false],
      ['ready', '2026-09-25', '2026-10-05', false],
      ['shipped', '2026-10-05', '2026-10-20', false],
      ['installation', '2026-10-20', '2026-10-30', false],
    ]);
    expect(currentStage(segs, TODAY)).toBe('installation');
  });

  it('runs the newest started stage to today, and marks a future one as a one-day point', () => {
    const running = lifecycleSegments(milestonesFrom([item({ std: '2026-10-01' })], [], null), install(), TODAY);
    expect(running).toEqual([{ stage: 'production', start: '2026-10-01', end: TODAY, open: true }]);
    const future = lifecycleSegments(null, install({ planned_start: '2026-12-01' }), TODAY);
    expect(future[0]).toMatchObject({ stage: 'installation', start: '2026-12-01', end: '2026-12-01' });
    expect(currentStage(future, TODAY)).toBeNull();
  });

  it('adds Completed for finished installs and never lets a stage start before the previous one', () => {
    const m = milestonesFrom([item({ std: '2026-09-10', rtr: '2026-08-01' })], [], null);
    const segs = lifecycleSegments(m, install({ planned_start: '2026-10-01', planned_finish: '2026-10-05', status: 'Completed' }), TODAY);
    expect(segs.find(s => s.stage === 'ready_to_receive')?.start).toBe('2026-09-10');
    expect(segs.at(-1)).toMatchObject({ stage: 'completed', start: '2026-10-05' });
    expect(currentStage(segs, TODAY)).toBe('completed');
  });

  it('draws nothing without any dates', () => {
    expect(lifecycleSegments(null, install(), TODAY)).toEqual([]);
  });
});

describe('undatedStage', () => {
  it('prefers the Trust board stage, then the opportunity sales stage', () => {
    expect(undatedStage('technical', 'negotiation')).toBe('technical');
    expect(undatedStage('in_production', 'negotiation')).toBe('negotiation'); // dated on the timeline instead
    expect(undatedStage(null, 'sales_design')).toBe('initial_design');
    expect(undatedStage(null, 'new')).toBe('queued');
    expect(undatedStage(null, 'closed_won')).toBeNull();
    expect(undatedStage(undefined, null)).toBeNull();
  });
});
