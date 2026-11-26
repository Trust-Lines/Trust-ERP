import { describe, expect, it } from 'vitest';
import { ariaSort, compareDates, compareText, daysSince } from '@/lib/ui/sort';

describe('compareDates', () => {
  const rows = ['2026-11-02', null, '2026-11-20', '2026-10-01'];
  it('newest first, no date last', () => {
    expect([...rows].sort((a, b) => compareDates(a, b, 'desc'))).toEqual(['2026-11-20', '2026-11-02', '2026-10-01', null]);
  });
  it('oldest first, no date still last', () => {
    expect([...rows].sort((a, b) => compareDates(a, b, 'asc'))).toEqual(['2026-10-01', '2026-11-02', '2026-11-20', null]);
  });
});

describe('compareText', () => {
  it('ignores case, empty last', () => {
    expect(['b', '', 'A'].sort((a, b) => compareText(a, b, 'asc'))).toEqual(['A', 'b', '']);
  });
});

describe('daysSince / ariaSort', () => {
  it('counts whole days', () => {
    expect(daysSince('2026-11-20T00:00:00Z', Date.parse('2026-11-26T12:00:00Z'))).toBe(6);
    expect(daysSince(null)).toBeNull();
  });
  it('marks only the sorted column', () => {
    expect(ariaSort({ key: 'due', dir: 'asc' }, 'due')).toBe('ascending');
    expect(ariaSort({ key: 'due', dir: 'asc' }, 'created')).toBe('none');
  });
});
