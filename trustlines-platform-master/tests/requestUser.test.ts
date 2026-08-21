import { describe, it, expect } from 'vitest';
import { isOpsRole, OPS_ROLES } from '@/lib/permissions/requestUser';

describe('isOpsRole', () => {
  it('allows the two full-admin roles', () => {
    expect(isOpsRole('ops_manager')).toBe(true);
    expect(isOpsRole('general_manager')).toBe(true);
  });

  it('rejects every other role', () => {
    for (const role of ['tlines_pm', 'trustlines_pm', 'accountant', 'designer', 'logistics', 'sales_marketing_manager']) {
      expect(isOpsRole(role)).toBe(false);
    }
  });

  it('rejects null / undefined / empty', () => {
    expect(isOpsRole(null)).toBe(false);
    expect(isOpsRole(undefined)).toBe(false);
    expect(isOpsRole('')).toBe(false);
  });

  it('does not include the removed `executive` role', () => {
    expect(isOpsRole('executive')).toBe(false);
    expect(OPS_ROLES).not.toContain('executive');
  });
});
