import { describe, it, expect } from 'vitest';
import {
  normalizeOrgName, normalizeWebsiteDomain, normalizeEmail, normalizePhone, findProspectDuplicates,
} from '@/lib/marketing/duplicates';
import { canAccessProspect } from '@/lib/marketing/prospectAccess';

describe('normalization helpers', () => {
  it('normalizeOrgName lowercases, trims, collapses whitespace', () => {
    expect(normalizeOrgName('  Acme   Retail Group ')).toBe('acme retail group');
    expect(normalizeOrgName(null)).toBeNull();
    expect(normalizeOrgName('')).toBeNull();
  });

  it('normalizeWebsiteDomain strips scheme, www, path and query', () => {
    expect(normalizeWebsiteDomain('https://www.Acme.com/store?ref=1')).toBe('acme.com');
    expect(normalizeWebsiteDomain('acme.com')).toBe('acme.com');
    expect(normalizeWebsiteDomain(null)).toBeNull();
  });

  it('normalizeEmail lowercases and trims', () => {
    expect(normalizeEmail('  John@ACME.com ')).toBe('john@acme.com');
  });

  it('normalizePhone strips everything but digits so formats match', () => {
    expect(normalizePhone('+1 (212) 555-0100')).toBe('12125550100');
    expect(normalizePhone('12125550100')).toBe('12125550100');
    expect(normalizePhone(null)).toBeNull();
  });
});

function fakeAdmin(rows: any[]) {
  return {
    from: (_table: string) => ({
      select: () => ({
        is: () => ({
          limit: async () => ({ data: rows, error: null }),
        }),
      }),
    }),
  } as any;
}

describe('findProspectDuplicates — advisory only, never blocks/merges', () => {
  const existing = [
    { id: 'p1', organization_name: 'Acme Retail Group', website: 'https://www.acme.com', main_email: 'info@acme.com', main_phone: '212-555-0100' },
    { id: 'p2', organization_name: 'Totally Different Co', website: 'different.com', main_email: 'x@different.com', main_phone: '555-000-0000' },
  ];

  it('matches on normalized organization name', async () => {
    const dups = await findProspectDuplicates(fakeAdmin(existing), { organizationName: '  ACME retail   group ' });
    expect(dups).toHaveLength(1);
    expect(dups[0].id).toBe('p1');
    expect(dups[0].matchedOn).toContain('organization_name');
  });

  it('matches on normalized website domain regardless of scheme/www', async () => {
    const dups = await findProspectDuplicates(fakeAdmin(existing), { website: 'acme.com' });
    expect(dups.map(d => d.id)).toContain('p1');
    expect(dups[0].matchedOn).toContain('website');
  });

  it('matches on normalized email', async () => {
    const dups = await findProspectDuplicates(fakeAdmin(existing), { email: 'INFO@ACME.COM' });
    expect(dups.map(d => d.id)).toContain('p1');
  });

  it('matches on normalized phone regardless of formatting', async () => {
    const dups = await findProspectDuplicates(fakeAdmin(existing), { phone: '(212) 555-0100' });
    expect(dups.map(d => d.id)).toContain('p1');
  });

  it('excludes the given id (self-match while editing)', async () => {
    const dups = await findProspectDuplicates(fakeAdmin(existing), { organizationName: 'Acme Retail Group' }, 'p1');
    expect(dups).toHaveLength(0);
  });

  it('returns nothing when no field is provided', async () => {
    const dups = await findProspectDuplicates(fakeAdmin(existing), {});
    expect(dups).toHaveLength(0);
  });

  it('de-dupes a single Prospect matched on multiple fields into one suggestion', async () => {
    const dups = await findProspectDuplicates(fakeAdmin(existing), { organizationName: 'Acme Retail Group', email: 'info@acme.com' });
    expect(dups).toHaveLength(1);
    expect(dups[0].matchedOn).toEqual(expect.arrayContaining(['organization_name', 'email']));
  });
});

describe('findProspectDuplicates — person leads (entity_type, migration 074)', () => {
  const existingPeople = [
    { id: 'p3', person_name: 'Jane Doe', organization_name: null, website: null, main_email: 'jane@example.com', main_phone: '555-111-2222' },
    { id: 'p4', person_name: 'John Smith', organization_name: null, website: null, main_email: 'john@example.com', main_phone: '555-333-4444' },
  ];

  it('matches on normalized person name', async () => {
    const dups = await findProspectDuplicates(fakeAdmin(existingPeople), { personName: '  jane   DOE ' });
    expect(dups).toHaveLength(1);
    expect(dups[0].id).toBe('p3');
    expect(dups[0].matchedOn).toContain('person_name');
  });

  it('a person name never matches against another row\'s organization_name, and vice versa', async () => {
    const orgRows = [{ id: 'p1', organization_name: 'Acme Retail Group', person_name: null, website: null, main_email: null, main_phone: null }];
    const dups = await findProspectDuplicates(fakeAdmin(orgRows), { personName: 'Acme Retail Group' });
    expect(dups).toHaveLength(0);
  });

  it('person leads still match on email/phone (entity-agnostic signals)', async () => {
    const dups = await findProspectDuplicates(fakeAdmin(existingPeople), { email: 'JANE@example.com' });
    expect(dups.map(d => d.id)).toContain('p3');
  });
});

function fakeProspectAdmin(row: any) {
  return {
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error: null }),
        }),
      }),
    }),
  } as any;
}

describe('canAccessProspect — object-level authorization (Phase 00.3)', () => {
  const owned = { created_by: 'u1', assigned_marketing_user_id: null, owner_id: null };
  const assigned = { created_by: 'other', assigned_marketing_user_id: 'u1', owner_id: null };
  const ownedByOwnerField = { created_by: 'other', assigned_marketing_user_id: null, owner_id: 'u1' };
  const someoneElses = { created_by: 'other', assigned_marketing_user_id: 'other', owner_id: 'other' };

  it('marketing_manager and general_manager reach every Prospect without a lookup', async () => {
    expect(await canAccessProspect(fakeProspectAdmin(someoneElses), 'p1', 'u1', 'marketing_manager')).toBe(true);
    expect(await canAccessProspect(fakeProspectAdmin(someoneElses), 'p1', 'u1', 'general_manager')).toBe(true);
  });

  it('marketing_pr reaches a Prospect they created, own, or are assigned to', async () => {
    expect(await canAccessProspect(fakeProspectAdmin(owned), 'p1', 'u1', 'marketing_pr')).toBe(true);
    expect(await canAccessProspect(fakeProspectAdmin(assigned), 'p1', 'u1', 'marketing_pr')).toBe(true);
    expect(await canAccessProspect(fakeProspectAdmin(ownedByOwnerField), 'p1', 'u1', 'marketing_pr')).toBe(true);
  });

  it('marketing_pr is denied a Prospect that is none of theirs', async () => {
    expect(await canAccessProspect(fakeProspectAdmin(someoneElses), 'p1', 'u1', 'marketing_pr')).toBe(false);
  });

  it('ops_manager reaches every Prospect without a lookup (2026-08-11: full Marketing write authority, same as general_manager)', async () => {
    expect(await canAccessProspect(fakeProspectAdmin(someoneElses), 'p1', 'u1', 'ops_manager')).toBe(true);
  });

  it('an unknown role is denied', async () => {
    expect(await canAccessProspect(fakeProspectAdmin(owned), 'p1', 'u1', 'sales_rep')).toBe(false);
  });

  it('a missing Prospect row denies everyone except manage roles', async () => {
    expect(await canAccessProspect(fakeProspectAdmin(null), 'missing', 'u1', 'marketing_pr')).toBe(false);
  });
});
