import { describe, it, expect } from 'vitest';
import { formatMoney } from '@/lib/sales/format';
import { scopeToCategories } from '@/lib/sales/scope';
import { composeProjectCode, REGIONS, SERVICE_LINES } from '@/lib/regions';

describe('formatMoney', () => {
  it('formats millions with one decimal', () => {
    expect(formatMoney(1_500_000)).toBe('$1.5M');
    expect(formatMoney(1_000_000)).toBe('$1.0M');
  });
  it('formats thousands, rounded', () => {
    expect(formatMoney(250_000)).toBe('$250K');
    expect(formatMoney(1_500)).toBe('$2K');
    expect(formatMoney(1_000)).toBe('$1K');
  });
  it('formats small values verbatim', () => {
    expect(formatMoney(999)).toBe('$999');
    expect(formatMoney(0)).toBe('$0');
  });
});

describe('scopeToCategories', () => {
  it('returns [] for empty / missing scope', () => {
    expect(scopeToCategories(null)).toEqual([]);
    expect(scopeToCategories(undefined)).toEqual([]);
    expect(scopeToCategories({})).toEqual([]);
  });
  it('maps only true flags, in a stable order', () => {
    expect(scopeToCategories({ shelving: true, image: true })).toEqual(['Shelving', 'Image']);
    expect(scopeToCategories({ ceiling: true, millwork: true }))
      .toEqual(['Millwork', 'Ceiling']);
  });
  it('ignores false and non-boolean values', () => {
    expect(scopeToCategories({ shelving: false, millwork: 'yes' as unknown as boolean })).toEqual([]);
  });
});

describe('composeProjectCode', () => {
  it('builds "{service}{region} {number}"', () => {
    expect(composeProjectCode('store_maker', 'CVW', 460)).toBe('STW 460');
    expect(composeProjectCode('premium_store_fitout', 'TLINES_NE', 6)).toBe('PSNE 6');
    expect(composeProjectCode('design_build', 'TLINES_SE', 1)).toBe('DSSE 1');
  });
  it('returns just the prefix when no number is reserved yet', () => {
    expect(composeProjectCode('store_maker', 'CVW')).toBe('STW');
  });
  it('yields an empty prefix for unknown codes rather than throwing', () => {
    expect(composeProjectCode('nope', 'nope', 5)).toBe(' 5');
  });
});

describe('region / service pick-lists', () => {
  it('exposes exactly the four live regions (HQ and TC removed)', () => {
    expect(REGIONS.map(r => r.code)).toEqual(['TLINES_NE', 'TLINES_SE', 'TLINES_NW', 'CVW']);
  });
  it('maps CVW to the short code W', () => {
    expect(REGIONS.find(r => r.code === 'CVW')?.codeShort).toBe('W');
  });
  it('has the three service lines with ST/PS/DS codes', () => {
    expect(SERVICE_LINES.map(s => s.codeShort).sort()).toEqual(['DS', 'PS', 'ST']);
  });
});
