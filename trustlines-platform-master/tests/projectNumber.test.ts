import { describe, expect, it } from 'vitest';
import { firstFree } from '@/lib/projects/number';

describe('firstFree — the next project number skips used ones', () => {
  it('starts from the number Sales set and steps over every used one', () => {
    const used = new Set([498, 499, 500, 501, 530]);
    expect(firstFree(498, used)).toBe(502);
    expect(firstFree(529, used)).toBe(529);
    expect(firstFree(530, used)).toBe(531);
  });

  it('never goes below 1', () => {
    expect(firstFree(0, new Set([1]))).toBe(2);
  });
});
