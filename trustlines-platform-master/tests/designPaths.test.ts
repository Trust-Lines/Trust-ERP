import { describe, expect, it } from 'vitest';
import { nextVersionNo, preProjectDesignRoot, relativeTo, resolveInside, safeSegment } from '@/lib/sales/designPaths';

const ROOT = '/Design/T LINES/US/Active/Clients/ACME/0042 - 1 Main St';

describe('resolveInside', () => {
  it('joins a relative path under the job folder', () => {
    expect(resolveInside(ROOT, '1-Plan Layout/1-PDF')).toBe(`${ROOT}/1-Plan Layout/1-PDF`);
    expect(resolveInside(ROOT, '')).toBe(ROOT);
    expect(resolveInside(ROOT, null)).toBe(ROOT);
    expect(resolveInside(ROOT, '/2-Estimate/')).toBe(`${ROOT}/2-Estimate`);
  });
  it('refuses anything that could leave the folder', () => {
    expect(resolveInside(ROOT, '..')).toBeNull();
    expect(resolveInside(ROOT, '2-Estimate/../../other')).toBeNull();
    expect(resolveInside(ROOT, './x')).toBeNull();
    expect(resolveInside(ROOT, 'a\\b')).toBeNull();
    expect(resolveInside(ROOT, 'a\u0007b')).toBeNull();
    expect(resolveInside(ROOT, 'C:/x')).toBeNull();
  });
});

describe('relativeTo', () => {
  it('strips the root case-insensitively', () => {
    expect(relativeTo(ROOT, `${ROOT.toLowerCase()}/2-estimate/a.pdf`)).toBe('2-estimate/a.pdf');
    expect(relativeTo(ROOT, ROOT)).toBe('');
  });
  it('rejects paths outside the root, including look-alike prefixes', () => {
    expect(relativeTo(ROOT, '/Design/other/a.pdf')).toBeNull();
    expect(relativeTo(ROOT, `${ROOT}-copy/a.pdf`)).toBeNull();
  });
});

describe('preProjectDesignRoot', () => {
  it('is stable, unique per job and Dropbox-safe', () => {
    const p = preProjectDesignRoot('a1b2c3d4-0000-4000-8000-000000000000', 'Sales Design — ACME / Store: #12');
    expect(p).toBe('/Design/Pre-Project/a1b2c3d4 - ACME Store #12');
  });
  it('falls back when the title is empty', () => {
    expect(preProjectDesignRoot('ffffffff-1', '   ')).toBe('/Design/Pre-Project/ffffffff - Design job');
  });
});

describe('safeSegment / nextVersionNo', () => {
  it('cleans names', () => {
    expect(safeSegment('  ..render?.png ')).toBe('render .png');
    expect(safeSegment('', 'x')).toBe('x');
  });
  it('picks the next V-number', () => {
    expect(nextVersionNo([])).toBe(1);
    expect(nextVersionNo(['V1', 'v3', 'Old', 'V2'])).toBe(4);
  });
});
