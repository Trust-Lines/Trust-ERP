import { describe, it, expect } from 'vitest';
import { DEFAULT_PERMISSIONS, effectivePermissions, permCan, ALL_PERM_KEYS } from '@/lib/permissions/catalog';

const INTERNAL_COST_KEYS = ['view.pf', 'view.prices', 'view.production_board'];

describe('tlines_pm internal-cost boundary', () => {
  const perms = DEFAULT_PERMISSIONS.tlines_pm;

  it.each(INTERNAL_COST_KEYS)('never grants %s', (key) => {
    expect(permCan(perms, key)).toBe(false);
  });

  it('is not an `all: true` role (that would bypass every check)', () => {
    expect(perms.all).not.toBe(true);
  });

  it('DOES grant view.po — they sign the Client PM box on the PO', () => {
    expect(permCan(perms, 'view.po')).toBe(true);
    expect(permCan(perms, 'sign.client_pm')).toBe(true);
  });

  it('still sees the document tabs it is entitled to', () => {
    expect(permCan(perms, 'view.tab_overview')).toBe(true);
    expect(permCan(perms, 'view.tab_plan_layout')).toBe(true);
    expect(permCan(perms, 'view.tab_design_proposal')).toBe(true);
  });
});

describe('customer-side and design roles never see internal cost', () => {
  const OUTSIDE_ROLES = ['tlines_pm', 'designer', 'design_lead', 'shop_drawer', 'sales_rep', 'sales_marketing_manager'];

  it.each(OUTSIDE_ROLES)('%s has no PF / prices surface', (role) => {
    const perms = DEFAULT_PERMISSIONS[role];
    expect(perms, `${role} must exist in DEFAULT_PERMISSIONS`).toBeDefined();
    expect(permCan(perms, 'view.pf')).toBe(false);
    expect(permCan(perms, 'view.prices')).toBe(false);
  });

  it('warehouse + QC roles never see margin (Phase 11 §7)', () => {
    for (const role of ['warehouse_manager', 'warehouse_user', 'qc_responsible']) {
      expect(permCan(DEFAULT_PERMISSIONS[role], 'view.prices')).toBe(false);
    }
  });
});

describe('internal Trust-Lines roles keep their PF access', () => {
  it.each(['trustlines_pm', 'project_manager', 'production_manager', 'supply_manager', 'supply_user', 'production_user'])(
    '%s can still see PF',
    (role) => {
      expect(permCan(DEFAULT_PERMISSIONS[role], 'view.pf')).toBe(true);
    },
  );

  it('general_manager and ops_manager hold full authority', () => {
    expect(DEFAULT_PERMISSIONS.general_manager.all).toBe(true);
    expect(DEFAULT_PERMISSIONS.ops_manager.all).toBe(true);
  });
});

describe('effectivePermissions', () => {
  it('returns the stored map WHOLE and does not merge the default', () => {
    const stored = { 'page.dashboard': true };
    const result = effectivePermissions('tlines_pm', stored);
    expect(result).toEqual(stored);
    expect(result['view.tab_overview']).toBeUndefined();
  });

  it('falls back to the default when nothing is stored', () => {
    expect(effectivePermissions('designer', null)).toEqual(DEFAULT_PERMISSIONS.designer);
    expect(effectivePermissions('designer', {})).toEqual(DEFAULT_PERMISSIONS.designer);
  });

  it('returns {} for an unknown role (fail closed)', () => {
    expect(effectivePermissions('pm__image', null)).toEqual({});
    expect(permCan(effectivePermissions('no_such_role', null), 'view.pf')).toBe(false);
  });
});

describe('role catalog integrity', () => {
  it('every default grants only keys the catalog defines', () => {
    const known = new Set(ALL_PERM_KEYS);
    for (const [role, perms] of Object.entries(DEFAULT_PERMISSIONS)) {
      for (const key of Object.keys(perms)) {
        if (key === 'all') continue;
        expect(known.has(key), `${role} grants unknown permission "${key}"`).toBe(true);
      }
    }
  });

  it('includes the Phase 11 roles that were approved, and excludes the deferred ones', () => {
    for (const role of ['design_lead', 'shop_drawer', 'supply_manager', 'supply_user', 'production_user', 'warehouse_manager', 'warehouse_user']) {
      expect(DEFAULT_PERMISSIONS[role], `${role} missing`).toBeDefined();
    }
    expect(DEFAULT_PERMISSIONS.luxury_pm).toBeUndefined();
    for (const role of ['millwork_designer', 'ceiling_designer', 'image_designer', 'graphic_designer']) {
      expect(DEFAULT_PERMISSIONS[role], `${role} must NOT be a role — it is a skill`).toBeUndefined();
    }
  });

  it('keeps the legacy signature-chain roles alive', () => {
    for (const role of ['pm_millwork', 'pm_ceiling', 'project_manager']) {
      expect(DEFAULT_PERMISSIONS[role], `${role} must not be dropped`).toBeDefined();
    }
  });
});
