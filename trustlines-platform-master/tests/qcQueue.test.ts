import { describe, it, expect } from 'vitest';
import { buildQcQueue, isInspectable, qcCounts, type QcItem, type QcInspection } from '@/lib/qc/queue';

const item = (o: Partial<QcItem> = {}): QcItem =>
  ({ id: 'i1', project_id: 'p1', type: 'Millwork', status: 'RECEIVED', ...o });
const insp = (o: Partial<QcInspection> = {}): QcInspection =>
  ({ id: 'q1', project_id: 'p1', production_item_id: 'i1', overall_result: 'pending',
     conducted_by: null, conducted_at: '2026-07-01', rework_of_id: null, ...o });

describe('isInspectable', () => {
  it('is false before the goods arrive', () => {
    for (const s of ['NOT_ORDERED', 'ORDERED', 'WAITING_PAYMENT', 'READY_TO_RECEIVE']) {
      expect(isInspectable(s), s).toBe(false);
    }
  });

  it('is true from RECEIVED onward', () => {
    for (const s of ['RECEIVED', 'READY', 'SENT_TO_TLINES', 'SENT']) {
      expect(isInspectable(s), s).toBe(true);
    }
  });

  it('is false for held / off-chain items — a held item is not waiting on QC', () => {
    for (const s of ['HOLD_T', 'HOLD_PM', 'ASSEMBLY']) expect(isInspectable(s), s).toBe(false);
  });

  it('fails closed on null / junk', () => {
    expect(isInspectable(null)).toBe(false);
    expect(isInspectable('NOPE')).toBe(false);
  });
});

describe('readyForQc', () => {
  it('lists an arrived item with no inspection', () => {
    const q = buildQcQueue([item()], [], null);
    expect(q.readyForQc.map(r => r.itemId)).toEqual(['i1']);
  });

  it('excludes an item that has not arrived yet', () => {
    expect(buildQcQueue([item({ status: 'ORDERED' })], [], null).readyForQc).toEqual([]);
  });

  it('excludes an item with an OPEN inspection — someone is already on it', () => {
    const q = buildQcQueue([item()], [insp({ overall_result: 'pending' })], null);
    expect(q.readyForQc).toEqual([]);
  });

  it('excludes a passed item', () => {
    const q = buildQcQueue([item()], [insp({ overall_result: 'pass' })], null);
    expect(q.readyForQc).toEqual([]);
    expect(q.completed.map(r => r.itemId)).toEqual(['i1']);
  });

  it('does NOT list a failed item as ready for QC — that work is rework', () => {
    const q = buildQcQueue([item()], [insp({ overall_result: 'fail' })], null);
    expect(q.readyForQc).toEqual([]);
    expect(q.rework.map(r => r.itemId)).toEqual(['i1']);
  });
});

describe('fail → rework → re-inspection loop', () => {
  it('a failure with no re-inspection is rework', () => {
    const q = buildQcQueue([item()], [insp({ id: 'q1', overall_result: 'fail' })], null);
    expect(q.failed.map(r => r.itemId)).toEqual(['i1']);
    expect(q.rework.map(r => r.itemId)).toEqual(['i1']);
  });

  it('once a re-inspection is OPEN the item leaves the rework queue', () => {
    const q = buildQcQueue([item()], [
      insp({ id: 'q1', overall_result: 'fail', conducted_at: '2026-07-01' }),
      insp({ id: 'q2', overall_result: 'pending', rework_of_id: 'q1', conducted_at: '2026-07-02' }),
    ], null);
    expect(q.rework).toEqual([]);
    expect(q.failed.map(r => r.itemId)).toEqual(['i1']);
  });

  it('a passing re-inspection clears the failure — newest verdict wins', () => {
    const q = buildQcQueue([item()], [
      insp({ id: 'q1', overall_result: 'fail', conducted_at: '2026-07-01' }),
      insp({ id: 'q2', overall_result: 'pass', rework_of_id: 'q1', conducted_at: '2026-07-05' }),
    ], null);
    expect(q.failed).toEqual([]);
    expect(q.rework).toEqual([]);
    expect(q.completed.map(r => r.itemId)).toEqual(['i1']);
    expect(q.completed[0].isRework).toBe(true);
  });

  it('a re-inspection that fails again stays rework', () => {
    const q = buildQcQueue([item()], [
      insp({ id: 'q1', overall_result: 'fail', conducted_at: '2026-07-01' }),
      insp({ id: 'q2', overall_result: 'fail', rework_of_id: 'q1', conducted_at: '2026-07-05' }),
    ], null);
    expect(q.rework.map(r => r.itemId)).toEqual(['i1']);
    expect(q.completed).toEqual([]);
  });

  it('an older pass does not override a newer fail', () => {
    const q = buildQcQueue([item()], [
      insp({ id: 'q1', overall_result: 'pass', conducted_at: '2026-07-01' }),
      insp({ id: 'q2', overall_result: 'fail', conducted_at: '2026-07-09' }),
    ], null);
    expect(q.completed).toEqual([]);
    expect(q.failed.map(r => r.itemId)).toEqual(['i1']);
  });
});

describe('myInspections', () => {
  it('only lists MY open inspection', () => {
    const q = buildQcQueue([item()], [insp({ overall_result: 'pending', conducted_by: 'me' })], 'me');
    expect(q.myInspections.map(r => r.itemId)).toEqual(['i1']);
    expect(buildQcQueue([item()], [insp({ overall_result: 'pending', conducted_by: 'other' })], 'me').myInspections).toEqual([]);
  });

  it('is empty for an anonymous / unresolved user rather than showing everyone', () => {
    const q = buildQcQueue([item()], [insp({ overall_result: 'pending', conducted_by: 'me' })], null);
    expect(q.myInspections).toEqual([]);
  });

  it('does not list a decided inspection', () => {
    const q = buildQcQueue([item()], [insp({ overall_result: 'pass', conducted_by: 'me' })], 'me');
    expect(q.myInspections).toEqual([]);
  });
});

describe('edge cases', () => {
  it('ignores a legacy project-level checklist with no item link', () => {
    const q = buildQcQueue([item()], [insp({ production_item_id: null, overall_result: 'fail' })], null);
    expect(q.failed).toEqual([]);
    expect(q.readyForQc.map(r => r.itemId)).toEqual(['i1']);
  });

  it('handles no items and no inspections', () => {
    const q = buildQcQueue([], [], 'me');
    expect(qcCounts(q)).toEqual({ readyForQc: 0, myInspections: 0, failed: 0, rework: 0, completed: 0 });
  });

  it('keeps each type separate — QC is per type, not per project', () => {
    const q = buildQcQueue(
      [item({ id: 'a', type: 'Millwork' }), item({ id: 'b', type: 'Ceiling' })],
      [insp({ id: 'q1', production_item_id: 'a', overall_result: 'pass' })],
      null,
    );
    expect(q.completed.map(r => r.type)).toEqual(['Millwork']);
    expect(q.readyForQc.map(r => r.type)).toEqual(['Ceiling']);
  });

  it('sorts stably by type so the list does not jump between loads', () => {
    const q = buildQcQueue(
      [item({ id: 'z', type: 'Shelving' }), item({ id: 'a', type: 'Ceiling' }), item({ id: 'm', type: 'Millwork' })],
      [], null,
    );
    expect(q.readyForQc.map(r => r.type)).toEqual(['Ceiling', 'Millwork', 'Shelving']);
  });
});
