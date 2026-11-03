import { describe, expect, it } from 'vitest';
import { effectivePermissions, pageAllowed } from '@/lib/permissions/catalog';

describe('Dashboard project popup switches', () => {
  it('show every tab but Finance by default, Finance only to the finance roles', () => {
    const pm = effectivePermissions('tlines_pm', null);
    expect(pageAllowed('tlines_pm', pm, 'view.card_production')).toBe(true);
    expect(pageAllowed('tlines_pm', pm, 'view.card_finance')).toBe(false);
    expect(pageAllowed('trustlines_pm', effectivePermissions('trustlines_pm', null), 'view.card_finance')).toBe(true);
  });

  it('follow the Roles page once set there', () => {
    const saved = { 'page.dashboard': true, 'view.card_finance': true, 'view.card_shipping': false };
    expect(pageAllowed('tlines_pm', saved, 'view.card_finance')).toBe(true);
    expect(pageAllowed('tlines_pm', saved, 'view.card_shipping')).toBe(false);
    expect(pageAllowed('tlines_pm', saved, 'view.card_deal')).toBe(true);
  });
});
