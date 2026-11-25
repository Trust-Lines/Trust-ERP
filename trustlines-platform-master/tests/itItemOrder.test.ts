import { describe, expect, it } from 'vitest';
import { byCustomOrder, moveId, positionChanges } from '@/lib/it/itemOrder';

const it_ = (id: string, addedAt: string, position: number | null) => ({ id, addedAt, position });

describe('byCustomOrder', () => {
  it('puts never-placed items first, newest first, then by place', () => {
    const list = [it_('a', '2026-11-01', 1), it_('b', '2026-11-02', null), it_('c', '2026-11-03', 0), it_('d', '2026-11-04', null)];
    expect(list.sort(byCustomOrder).map(i => i.id)).toEqual(['d', 'b', 'c', 'a']);
  });
});

describe('moveId', () => {
  it('moves down onto the target’s place', () => {
    expect(moveId(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
  });
  it('moves up onto the target’s place', () => {
    expect(moveId(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
  });
  it('leaves the order alone for an unknown id', () => {
    expect(moveId(['a', 'b'], 'x', 'a')).toEqual(['a', 'b']);
  });
});

describe('positionChanges', () => {
  it('sends only the items whose place changes', () => {
    const items = [it_('a', '', 0), it_('b', '', 1), it_('c', '', 2), it_('d', '', null)];
    expect(positionChanges(items, ['a', 'c', 'b', 'd'])).toEqual([{ id: 'c', position: 1 }, { id: 'b', position: 2 }, { id: 'd', position: 3 }]);
  });
});
