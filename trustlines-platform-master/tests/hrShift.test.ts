import { describe, it, expect } from 'vitest';
import { statusAfter, punchAllowed } from '@/lib/hr/shift';

describe('shift punch state', () => {
  it('derives the status from the latest punch', () => {
    expect(statusAfter(null)).toBe('off');
    expect(statusAfter('in')).toBe('on');
    expect(statusAfter('break_start')).toBe('break');
    expect(statusAfter('break_end')).toBe('on');
    expect(statusAfter('out')).toBe('off');
  });

  it('only allows the punches that make sense next', () => {
    expect(punchAllowed(null, 'in')).toBe(true);
    expect(punchAllowed(null, 'out')).toBe(false);
    expect(punchAllowed('in', 'in')).toBe(false);          // double tap
    expect(punchAllowed('in', 'break_start')).toBe(true);
    expect(punchAllowed('break_start', 'out')).toBe(false); // end the break first
    expect(punchAllowed('break_start', 'break_end')).toBe(true);
    expect(punchAllowed('break_end', 'out')).toBe(true);
    expect(punchAllowed('out', 'in')).toBe(true);
  });
});
