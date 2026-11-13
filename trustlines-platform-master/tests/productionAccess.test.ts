import { describe, expect, it } from 'vitest';
import { productionAccess } from '@/lib/production/access';

describe('Production Board switches (Roles page)', () => {
  it('follow the page and edit.production until a role sets them', () => {
    const a = productionAccess('supply_user', { 'page.production': true, 'edit.production': true });
    expect(a.tabProjects && a.tabMissingExtra && a.tabDirectOrders && a.viewMoney && a.export).toBe(true);
    expect(a.editStatus && a.editRows && a.deleteRows && a.editProjects && a.todo && a.groups && a.half).toBe(true);
    // Delete Project stays with general / ops manager until set.
    expect(a.deleteProjects).toBe(false);
    expect(productionAccess('general_manager', { 'page.production': true, 'edit.production': true }).deleteProjects).toBe(true);
  });

  it('view-only role: sees the board, edits nothing', () => {
    const a = productionAccess('warehouse_user', { 'page.production': true });
    expect(a.tabProjects && a.viewMoney && a.export).toBe(true);
    expect(a.editStatus || a.editRows || a.deleteRows || a.editProjects || a.todo || a.groups || a.half).toBe(false);
  });

  it('a switch set on the role wins', () => {
    const a = productionAccess('x', {
      'page.production': true, 'edit.production': true,
      'prod.view_money': false, 'prod.tab_direct_orders': false, 'prod.delete_rows': false, 'prod.delete_projects': true,
    });
    expect(a.viewMoney).toBe(false);
    expect(a.tabDirectOrders).toBe(false);
    expect(a.deleteRows).toBe(false);
    expect(a.deleteProjects).toBe(true);
    expect(a.editStatus).toBe(true);
  });

  it('tlines_pm never gets PF fields or money, even with the switches on', () => {
    const a = productionAccess('tlines_pm', { 'page.production': true, 'prod.view_money': true, 'prod.export': true });
    expect(a.tabProjects && a.export).toBe(true);
    expect(a.viewPf).toBe(false);
    expect(a.viewMoney).toBe(false);
  });

  it('no Production board page → nothing', () => {
    const a = productionAccess('x', { 'edit.production': true, 'prod.edit_status': true });
    expect(Object.values(a).some(Boolean)).toBe(false);
  });
});
