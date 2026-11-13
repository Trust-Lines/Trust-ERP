import { describe, expect, it } from 'vitest';
import { makeQuickMatcher, type PfFlag, type PfGroup, type QuickToken } from '@/components/platform/production/ProductionFlags';
import type { PItem } from '@/lib/excel/projectsExcelExport';

const row = (p: Partial<PItem>): PItem => ({ id: 'i1', projectId: 'p1', type: 'Millwork', status: 'NOT_ORDERED', pfSignStatus: 'NOT_SIGNED', poSignStatus: 'NOT_SIGNED', ...p });
const flag = (p: Partial<PfFlag>): PfFlag => ({ id: 'f', kind: 'PF', projectId: 'p1', projectCode: 'STNE 440', projectName: '', type: 'Millwork', itemId: null, completedAt: null, createdAt: '2026-11-01', ...p });
const groups: PfGroup[] = [{ id: 'g', number: 1, members: [{ id: 'm', rank: 1, projectId: 'p2', projectCode: 'STNE 409', type: 'Shelving' }] }];
const m = (t: QuickToken[], flags: PfFlag[] = []) => makeQuickMatcher(new Set(t), flags, groups);

describe('Production tracker quick filters (Trust System rules)', () => {
  it('no chip keeps every row', () => { expect(m([])(row({}))).toBe(true); });

  it('To do / Follow Up keep flagged project + type, or the flagged PF row', () => {
    expect(m(['TODO'], [flag({})])(row({}))).toBe(true);
    expect(m(['TODO'], [flag({ type: 'image' })])(row({ type: 'Image' }))).toBe(true);
    expect(m(['TODO'], [flag({ kind: 'FOLLOWUP' })])(row({}))).toBe(false);
    expect(m(['FOLLOWUP'], [flag({ kind: 'FOLLOWUP', itemId: 'i9', type: 'X' })])(row({ id: 'i9' }))).toBe(true);
  });

  it('sign / status chips keep rows matching ANY of them', () => {
    const r = m(['PO_T', 'TO_ORDER']);
    expect(r(row({ poSignStatus: 'WAITING_T_TO_SIGN' }))).toBe(true);
    expect(r(row({ status: 'TO_ORDER' }))).toBe(true);
    expect(r(row({}))).toBe(false);
    expect(m(['PO_TLINES'])(row({ poSignStatus: 'WAITING_TLINES_TO_SIGN' }))).toBe(true);
    expect(m(['PF_T'])(row({ pfSignStatus: 'WAITING_T_TO_SIGN' }))).toBe(true);
    expect(m(['BOOKS_IN_PROGRESS'])(row({ status: 'BOOKS_IN_PROGRESS' }))).toBe(true);
  });

  it('Groups keeps project + types in a PF group; chip groups combine with AND', () => {
    expect(m(['GROUPS'])(row({ projectId: 'p2', type: 'Shelving' }))).toBe(true);
    expect(m(['GROUPS'])(row({}))).toBe(false);
    expect(m(['GROUPS', 'TO_ORDER'])(row({ projectId: 'p2', type: 'Shelving' }))).toBe(false);
  });
});
