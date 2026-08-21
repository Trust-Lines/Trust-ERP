import { describe, it, expect } from 'vitest';
import {
  COMPANY_SIDES, OFFICES, DEPARTMENTS, SKILLS,
  isCompanySide, isOffice, isDepartment, isSkill,
  normalizeSkills, officeLabel,
  defaultCompanySideForRole, defaultDepartmentForRole,
  DEPARTMENT_LABELS, SKILL_LABELS, OFFICE_LABELS, COMPANY_SIDE_LABELS,
} from '@/lib/profile/metadata';
import { DEFAULT_PERMISSIONS } from '@/lib/permissions/catalog';

describe('metadata value sets', () => {
  it('matches the Phase 11 §3 sets (+ Phase 00.2 marketing) exactly', () => {
    expect([...COMPANY_SIDES]).toEqual(['trust_lines', 't_lines']);
    expect([...OFFICES]).toEqual(['turkey', 'syria', 'usa', 'other']);
    expect([...DEPARTMENTS]).toEqual([
      'sales', 'marketing', 'design', 'pm', 'supply', 'production',
      'qc', 'warehouse', 'logistics', 'accounting', 'management',
    ]);
    expect([...SKILLS]).toEqual([
      'millwork', 'shelving', 'ceiling', 'image',
      'graphic', 'shop_drawing', 'furniture', 'decoration',
    ]);
  });

  it('labels every value (no blank dropdown entries)', () => {
    for (const v of COMPANY_SIDES) expect(COMPANY_SIDE_LABELS[v]).toBeTruthy();
    for (const v of OFFICES)       expect(OFFICE_LABELS[v]).toBeTruthy();
    for (const v of DEPARTMENTS)   expect(DEPARTMENT_LABELS[v]).toBeTruthy();
    for (const v of SKILLS)        expect(SKILL_LABELS[v]).toBeTruthy();
  });
});

describe('validators fail closed', () => {
  it('accepts only known values', () => {
    expect(isCompanySide('trust_lines')).toBe(true);
    expect(isOffice('syria')).toBe(true);
    expect(isDepartment('design')).toBe(true);
    expect(isSkill('millwork')).toBe(true);
  });

  it('rejects the legacy free-text office values that 051 allowed', () => {
    expect(isOffice('Syria Office')).toBe(false);
    expect(isOffice('Trust Lines Türkiye')).toBe(false);
  });

  it('rejects junk, null and case variants', () => {
    for (const v of [null, undefined, '', 'TURKEY', 'Design', 42, {}, []]) {
      expect(isOffice(v)).toBe(false);
      expect(isDepartment(v)).toBe(false);
      expect(isCompanySide(v)).toBe(false);
      expect(isSkill(v)).toBe(false);
    }
  });
});

describe('normalizeSkills', () => {
  it('keeps valid skills and drops unknown ones', () => {
    expect(normalizeSkills(['millwork', 'nope', 'ceiling'])).toEqual(['millwork', 'ceiling']);
  });

  it('de-duplicates', () => {
    expect(normalizeSkills(['image', 'image', 'image'])).toEqual(['image']);
  });

  it('returns [] for non-arrays (never throws, never null)', () => {
    for (const v of [null, undefined, 'millwork', 42, {}]) {
      expect(normalizeSkills(v)).toEqual([]);
    }
  });

  it('supports a multi-skill person — the whole point of the 11.1 decision', () => {
    expect(normalizeSkills(['millwork', 'ceiling', 'shop_drawing'])).toEqual(['millwork', 'ceiling', 'shop_drawing']);
  });
});

describe('officeLabel', () => {
  it('labels a code', () => {
    expect(officeLabel('syria')).toBe('Syria');
  });

  it('passes legacy free text through instead of showing a blank', () => {
    expect(officeLabel('Syria Office')).toBe('Syria Office');
  });

  it('returns null for empty', () => {
    expect(officeLabel(null)).toBeNull();
    expect(officeLabel('')).toBeNull();
  });
});

describe('role → org defaults (mirrored by migration 066 backfill)', () => {
  it('puts the customer-facing roles on the t_lines side', () => {
    for (const role of ['tlines_pm', 'sales_rep', 'sales_marketing_manager']) {
      expect(defaultCompanySideForRole(role)).toBe('t_lines');
    }
  });

  it('puts internal supply/production/design/ops roles on the trust_lines side', () => {
    for (const role of ['trustlines_pm', 'designer', 'supply_manager', 'production_manager', 'warehouse_user', 'ops_manager', 'general_manager']) {
      expect(defaultCompanySideForRole(role)).toBe('trust_lines');
    }
  });

  it('never guesses for a missing role', () => {
    expect(defaultCompanySideForRole(null)).toBeNull();
    expect(defaultDepartmentForRole(undefined)).toBeNull();
  });

  it('maps each role to a department', () => {
    expect(defaultDepartmentForRole('designer')).toBe('design');
    expect(defaultDepartmentForRole('shop_drawer')).toBe('design');
    expect(defaultDepartmentForRole('tlines_pm')).toBe('pm');
    expect(defaultDepartmentForRole('supply_user')).toBe('supply');
    expect(defaultDepartmentForRole('warehouse_manager')).toBe('warehouse');
    expect(defaultDepartmentForRole('accountant')).toBe('accounting');
    expect(defaultDepartmentForRole('general_manager')).toBe('management');
  });

  it('covers EVERY role in the permission catalog', () => {
    for (const role of Object.keys(DEFAULT_PERMISSIONS)) {
      expect(defaultDepartmentForRole(role), `${role} has no department mapping`).not.toBeNull();
      expect(defaultCompanySideForRole(role), `${role} has no company_side`).not.toBeNull();
    }
  });

  it('returns a department that is in the valid set', () => {
    for (const role of Object.keys(DEFAULT_PERMISSIONS)) {
      const dept = defaultDepartmentForRole(role);
      expect(isDepartment(dept)).toBe(true);
    }
  });
});
