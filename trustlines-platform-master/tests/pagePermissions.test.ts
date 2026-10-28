import { describe, it, expect } from 'vitest';
import {
  ALL_PERM_KEYS, DEFAULT_PERMISSIONS, PAGE_LEGACY_ROLES, PAGE_PARENT, PAGE_ROUTES, pageAllowed, pageInherited,
} from '@/lib/permissions/catalog';
import { buildNavSections } from '@/components/platform/shell/Sidebar';
import type { UserRole } from '@/types/database';

const links = (role: string, perms: Record<string, boolean>) =>
  buildNavSections(role as UserRole, perms).flatMap(s => s.items.map(i => i.href));

describe('page access', () => {
  it('a page the role has not set follows its parent page', () => {
    const marketing = { 'page.marketing': true };
    expect(pageAllowed('marketing_pr', marketing, 'page.marketing_contact_manager')).toBe(true);
    expect(pageAllowed('marketing_pr', {}, 'page.marketing_contact_manager')).toBe(false);
    expect(pageAllowed('accountant', { 'page.expenses': true }, 'page.invoices')).toBe(true);
    expect(pageInherited(marketing, 'page.marketing_contact_manager')).toBe(true);
  });

  it('an explicit switch on the Roles page wins over the default', () => {
    const blocked = { 'page.marketing': true, 'page.marketing_contact_manager': false };
    expect(pageAllowed('marketing_pr', blocked, 'page.marketing_contact_manager')).toBe(false);
    expect(pageAllowed('marketing_pr', blocked, 'page.marketing_contacts')).toBe(true);
    const granted = { 'page.marketing_calendar': true };
    expect(pageAllowed('designer', granted, 'page.marketing_calendar')).toBe(true);
    expect(pageInherited(blocked, 'page.marketing_contact_manager')).toBe(false);
  });

  it('Sales pages default to the role lists they used to check in code', () => {
    expect(pageAllowed('sales_rep', {}, 'page.leads')).toBe(true);
    expect(pageAllowed('sales_rep', {}, 'page.sales_team')).toBe(false);
    expect(pageAllowed('sales_marketing_manager', {}, 'page.sales_dashboard')).toBe(true);
    expect(pageAllowed('marketing_pr', {}, 'page.leads')).toBe(false);
    expect(pageAllowed('sales_rep', { 'page.leads': false }, 'page.leads')).toBe(false);
  });

  it('superadmin roles can open everything', () => {
    for (const key of PAGE_ROUTES.map(r => r.key)) expect(pageAllowed('general_manager', { all: true }, key)).toBe(true);
  });

  it('every page in the app is listed on the Roles page, and every inherited key has a real parent', () => {
    for (const { key } of PAGE_ROUTES) expect(ALL_PERM_KEYS, `${key} not on the Roles page`).toContain(key);
    for (const parent of Object.values(PAGE_PARENT)) expect(ALL_PERM_KEYS).toContain(parent);
    for (const key of [...Object.keys(PAGE_PARENT), ...Object.keys(PAGE_LEGACY_ROLES)]) expect(ALL_PERM_KEYS).toContain(key);
  });
});

describe('sidebar follows the same rule', () => {
  it('nobody loses a link on day one: marketing and sales roles keep their pages', () => {
    const mk = links('marketing_pr', DEFAULT_PERMISSIONS.marketing_pr);
    for (const href of ['/marketing', '/marketing/prospects', '/marketing/contact-manager', '/marketing/email', '/marketing/mail-templates',
      '/marketing/campaigns', '/marketing/social', '/marketing/calendar', '/marketing/website', '/marketing/prospects/trash']) {
      expect(mk, href).toContain(href);
    }
    const rep = links('sales_rep', DEFAULT_PERMISSIONS.sales_rep);
    for (const href of ['/leads', '/leads/new', '/sales-tasks', '/sales-projects', '/leads/trash']) expect(rep, href).toContain(href);
    expect(rep).not.toContain('/sales-team');
    expect(links('sales_marketing_manager', DEFAULT_PERMISSIONS.sales_marketing_manager)).toContain('/sales-team');
  });

  it('hides a page switched off for the role', () => {
    const perms = { ...DEFAULT_PERMISSIONS.marketing_pr, 'page.marketing_contact_manager': false };
    const mk = links('marketing_pr', perms);
    expect(mk).not.toContain('/marketing/contact-manager');
    expect(mk).toContain('/marketing/prospects');
  });

  it('does not show a Sales group to internal roles that only have Customers', () => {
    const sections = buildNavSections('trustlines_pm' as UserRole, DEFAULT_PERMISSIONS.trustlines_pm);
    expect(sections.some(s => s.key === 'sales')).toBe(false);
    expect(sections.some(s => s.key === 'marketing')).toBe(false);
  });
});
