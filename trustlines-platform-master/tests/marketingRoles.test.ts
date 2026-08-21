import { describe, it, expect } from 'vitest';
import { DEFAULT_PERMISSIONS, permCan, PAGE_ROUTES, ALL_PERM_KEYS } from '@/lib/permissions/catalog';
import { SALES_INTAKE_ROLES, SALES_DELIVER_ROLES } from '@/lib/sales/roles';
import { MARKETING_ROLES, MARKETING_MANAGE_ROLES, MARKETING_SEE_ALL_ROLES, MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';

const NO_MONEY_KEYS = ['view.pf', 'view.prices', 'view.po', 'view.production_board'];
const NO_PROJECT_KEYS = ['edit.projects', 'page.production', 'page.suppliers', 'page.expenses'];

describe('page.marketing exists and is wired', () => {
  it('is a registered page route (nav + URL gate)', () => {
    expect(PAGE_ROUTES.some(p => p.key === 'page.marketing' && p.route === '/marketing')).toBe(true);
  });

  it('is a real catalog key', () => {
    expect(ALL_PERM_KEYS).toContain('page.marketing');
    expect(ALL_PERM_KEYS).toContain('edit.marketing');
  });
});

describe('marketing_pr / marketing_manager boundaries', () => {
  it.each(MARKETING_ROLES)('%s exists in DEFAULT_PERMISSIONS', (role) => {
    expect(DEFAULT_PERMISSIONS[role]).toBeDefined();
  });

  it.each(MARKETING_ROLES)('%s can open the Marketing workspace', (role) => {
    expect(permCan(DEFAULT_PERMISSIONS[role], 'page.marketing')).toBe(true);
    expect(permCan(DEFAULT_PERMISSIONS[role], 'edit.marketing')).toBe(true);
  });

  it.each(MARKETING_ROLES)('%s is not an `all: true` role', (role) => {
    expect(DEFAULT_PERMISSIONS[role].all).not.toBe(true);
  });

  for (const role of MARKETING_ROLES) {
    it.each(NO_MONEY_KEYS)(`${role} never grants %s`, (key) => {
      expect(permCan(DEFAULT_PERMISSIONS[role], key)).toBe(false);
    });
    it.each(NO_PROJECT_KEYS)(`${role} never grants %s`, (key) => {
      expect(permCan(DEFAULT_PERMISSIONS[role], key)).toBe(false);
    });
  }

  it('neither role can reach the Sales intake/deliver flow — cannot create a Project, ' +
     'reserve a project number, or touch Dropbox (PATCH /api/leads/[id]/intake, /deliver)', () => {
    for (const role of MARKETING_ROLES) {
      expect(SALES_INTAKE_ROLES, `${role} must not be a Sales intake role`).not.toContain(role);
      expect(SALES_DELIVER_ROLES, `${role} must not be a Sales deliver role`).not.toContain(role);
    }
  });

  it('does not grant page.customers — Prospect capture is Marketing-only, Customer is Sales/PM territory', () => {
    for (const role of MARKETING_ROLES) {
      expect(permCan(DEFAULT_PERMISSIONS[role], 'page.customers')).toBe(false);
    }
  });
});

describe('Sales does not get Marketing configuration by default', () => {
  it.each(['sales_rep', 'sales_marketing_manager'])('%s has no page.marketing', (role) => {
    expect(permCan(DEFAULT_PERMISSIONS[role], 'page.marketing')).toBe(false);
  });
});

describe('MARKETING_MANAGE_ROLES — write authority (2026-08-11: ops_manager included)', () => {
  it('contains marketing_manager, general_manager and ops_manager', () => {
    expect(MARKETING_MANAGE_ROLES).toEqual(
      expect.arrayContaining(['marketing_manager', 'general_manager', 'ops_manager']),
    );
  });

  it('does NOT contain marketing_pr (own-records-only — a distinct, narrower rule)', () => {
    expect(MARKETING_MANAGE_ROLES).not.toContain('marketing_pr');
  });
});

describe('MARKETING_SEE_ALL_ROLES / MARKETING_WRITE_ROLES — ops_manager has full Marketing authority', () => {
  it('contains manager + full-authority + ops_manager', () => {
    expect(MARKETING_SEE_ALL_ROLES).toEqual(
      expect.arrayContaining(['marketing_manager', 'general_manager', 'ops_manager']),
    );
  });

  it('ops_manager is in both the read-all AND the write set (2026-08-11 decision — see lib/marketing/roles.ts)', () => {
    expect(MARKETING_SEE_ALL_ROLES).toContain('ops_manager');
    expect(MARKETING_WRITE_ROLES).toContain('ops_manager');
  });
});

describe('general_manager / ops_manager retain full authority', () => {
  it('both are `all: true` and therefore implicitly hold page.marketing', () => {
    expect(DEFAULT_PERMISSIONS.general_manager.all).toBe(true);
    expect(DEFAULT_PERMISSIONS.ops_manager.all).toBe(true);
    expect(permCan(DEFAULT_PERMISSIONS.general_manager, 'page.marketing')).toBe(true);
    expect(permCan(DEFAULT_PERMISSIONS.ops_manager, 'page.marketing')).toBe(true);
  });
});

describe('executive role is not used', () => {
  it('is not one of the Marketing roles and not referenced by MARKETING_MANAGE_ROLES', () => {
    expect(MARKETING_ROLES).not.toContain('executive');
    expect(MARKETING_MANAGE_ROLES).not.toContain('executive');
    expect(DEFAULT_PERMISSIONS.executive).toBeUndefined();
  });
});
