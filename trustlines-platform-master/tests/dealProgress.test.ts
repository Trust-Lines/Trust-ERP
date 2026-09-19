import { describe, it, expect } from 'vitest';
import { buildDealProgress, stageStep } from '@/lib/sales/dealProgress';

const opp = (o: Record<string, unknown> = {}) => ({
  stage: 'proposal' as const, created_at: '2026-09-19T10:00:00Z', external_created_at: '2026-03-01T09:00:00Z',
  sales_handoff_at: null, sales_accepted_at: null, closed_at: null, closed_reason: null, return_reason: null,
  updated_at: '2026-09-19T10:00:00Z', ...o,
});

describe('stageStep', () => {
  it('places each stage on the path', () => {
    expect(stageStep('sales_handoff')).toBe(0);
    expect(stageStep('sales_accepted')).toBe(1);
    expect(stageStep('working_on_it_trust')).toBe(2);
    expect(stageStep('proposal')).toBe(3);
    expect(stageStep('negotiation')).toBe(4);
    expect(stageStep('closed_won')).toBe(5);
    expect(stageStep('closed_lost')).toBe(5);
    expect(stageStep('on_hold')).toBe(-2);       // waiting on the client — not a position
    expect(stageStep('marketing_qualification')).toBe(-1); // still with Marketing
  });
});

describe('buildDealProgress', () => {
  it('uses the ClickUp creation date and lists everything newest first', () => {
    const p = buildDealProgress({
      opp: opp(), project: null, job: null, names: { u1: 'Rana' },
      notes: [
        { author_name: 'Hachem', body: 'Sent the proposal to the client.', source_created_at: '2026-05-10T12:00:00Z', created_at: '2026-09-19T10:00:00Z' },
        { author_name: 'Donia', body: 'Client asked about the timeline.', source_created_at: '2026-06-02T12:00:00Z', created_at: '2026-09-19T10:00:00Z' },
      ],
      activity: [{ actor_id: 'u1', kind: 'change', body: 'completed task "Follow up"', created_at: '2026-07-01T08:00:00Z' }],
    });
    expect(p.events.map(e => e.at.slice(0, 10))).toEqual(['2026-07-01', '2026-06-02', '2026-05-10', '2026-03-01']);
    expect(p.events.at(-1)).toMatchObject({ type: 'milestone', text: 'Deal created in ClickUp' });
    expect(p.events[0]).toMatchObject({ type: 'change', by: 'Rana' });
    expect(p.events[2]).toMatchObject({ type: 'comment', by: 'Hachem', detail: 'Sent the proposal to the client.' });
    expect(p.lastActivityAt).toBe('2026-07-01T08:00:00Z');
  });

  it('adds the handoff / accept / project / design / close milestones', () => {
    const p = buildDealProgress({
      opp: opp({ stage: 'closed_lost', external_created_at: null, created_at: '2026-01-01T00:00:00Z', sales_handoff_at: '2026-01-02T00:00:00Z',
        sales_accepted_at: '2026-01-03T00:00:00Z', closed_at: '2026-02-01T00:00:00Z', closed_reason: 'Went with another vendor' }),
      project: { code: 'CVW-101', current_stage: 'production', created_at: '2026-01-03T00:00:01Z' },
      job: { status: 'presented_to_customer', assigned_designer_id: 'd1', created_at: '2026-01-04T00:00:00Z', updated_at: '2026-01-20T00:00:00Z' },
      notes: [], activity: [], names: { d1: 'Sara' },
    });
    expect(p.events.map(e => e.text)).toEqual([
      'Closed — lost', 'Design: Presented to customer', 'Design job started', 'Project CVW-101 opened', 'Accepted by Sales', 'Handed off to Sales', 'Deal created',
    ]);
    expect(p.events[0]).toMatchObject({ text: 'Closed — lost', detail: 'Went with another vendor' });
    expect(p.project).toMatchObject({ code: 'CVW-101', stage: 'production', stageLabel: 'Production' });
    expect(p.designJob).toMatchObject({ statusLabel: 'Presented to customer', designerName: 'Sara' });
  });

  it('shows the return reason when Marketing got the deal back, and ignores bad dates', () => {
    const p = buildDealProgress({
      opp: opp({ stage: 'marketing_qualification', return_reason: 'Budget not confirmed', external_created_at: null, updated_at: '2026-09-20T10:00:00Z' }),
      project: null, job: null, notes: [{ author_name: null, body: 'x', source_created_at: 'not-a-date', created_at: 'also-bad' }], activity: [], names: {},
    });
    expect(p.events[0]).toMatchObject({ text: 'Returned to Marketing', detail: 'Budget not confirmed' });
    expect(p.events).toHaveLength(2); // + "Deal created"; the comment with unusable dates is skipped
  });

  it('imported closes: no fake "closed today" date, and the ClickUp label is not shown as a reason', () => {
    const fallback = buildDealProgress({
      opp: opp({ stage: 'closed_won', closed_at: '2026-09-19T10:00:30Z', closed_reason: 'DEAL CLOSED' }),
      project: null, job: null, notes: [], activity: [], names: {},
    });
    expect(fallback.events.map(e => e.text)).toEqual(['Deal created in ClickUp']);
    const real = buildDealProgress({
      opp: opp({ stage: 'closed_won', closed_at: '2025-04-18T08:00:00Z', closed_reason: 'DEAL CLOSED', external_created_at: '2025-03-24T00:00:00Z' }),
      project: null, job: null, notes: [], activity: [], names: {},
    });
    expect(real.events[0]).toMatchObject({ text: 'Closed — won', detail: null });
  });

  it('long comments are clipped for the timeline', () => {
    const p = buildDealProgress({
      opp: opp(), project: null, job: null, activity: [], names: {},
      notes: [{ author_name: 'A', body: 'word '.repeat(200), source_created_at: '2026-05-10T12:00:00Z', created_at: '2026-05-10T12:00:00Z' }],
    });
    const c = p.events.find(e => e.type === 'comment')!;
    expect(c.detail!.length).toBeLessThanOrEqual(221);
    expect(c.detail!.endsWith('…')).toBe(true);
  });
});
