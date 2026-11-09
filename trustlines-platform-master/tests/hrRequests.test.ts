import { describe, it, expect } from 'vitest';
import { canManage, leaveDays, validateRequest } from '@/lib/hr/requests';

const NOW = Date.parse('2026-11-09T12:00:00Z');

describe('HR requests', () => {
  it('lets the manager or ops/GM decide, never the requester', () => {
    const target = { id: 'emp', manager_id: 'boss' };
    expect(canManage({ id: 'boss', role: 'qc_responsible' }, target)).toBe(true);
    expect(canManage({ id: 'gm', role: 'general_manager' }, target)).toBe(true);
    expect(canManage({ id: 'peer', role: 'qc_responsible' }, target)).toBe(false);
    expect(canManage({ id: 'emp', role: 'general_manager' }, target)).toBe(false);
  });

  it('counts leave days inclusively', () => {
    expect(leaveDays('2026-11-10', '2026-11-10')).toBe(1);
    expect(leaveDays('2026-11-10', '2026-11-14')).toBe(5);
  });

  it('validates leave requests', () => {
    expect(validateRequest({ kind: 'leave', reason: 'vacation', start_date: '2026-12-01', end_date: '2026-12-05' }, NOW)).toHaveProperty('value');
    expect(validateRequest({ kind: 'leave', reason: 'vacation', start_date: '2026-12-05', end_date: '2026-12-01' }, NOW)).toHaveProperty('error');
    expect(validateRequest({ kind: 'leave', reason: 'party', start_date: '2026-12-01', end_date: '2026-12-01' }, NOW)).toHaveProperty('error');
    expect(validateRequest({ kind: 'leave', reason: 'sick', start_date: '12/01/2026', end_date: '2026-12-01' }, NOW)).toHaveProperty('error');
  });

  it('validates punch corrections', () => {
    const ok = validateRequest({ kind: 'correction', correction_kind: 'in', correction_at: '2026-11-09T05:00:00Z', description: 'Telefon kapalıydı' }, NOW);
    expect(ok).toHaveProperty('value');
    expect(validateRequest({ kind: 'correction', correction_kind: 'in', correction_at: '2026-11-10T05:00:00Z', description: 'x' }, NOW)).toHaveProperty('error'); // future
    expect(validateRequest({ kind: 'correction', correction_kind: 'in', correction_at: '2026-09-01T05:00:00Z', description: 'x' }, NOW)).toHaveProperty('error'); // too old
    expect(validateRequest({ kind: 'correction', correction_kind: 'in', correction_at: '2026-11-09T05:00:00Z' }, NOW)).toHaveProperty('error'); // no reason
  });
});
