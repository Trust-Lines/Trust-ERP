import { describe, it, expect } from 'vitest';
import { buildSearchFilter, prospectIdsMatchingContacts, SEARCH_CONTACT_ID_CAP } from '@/lib/marketing/prospectQuery';

describe('Contacts search finds the people inside a company', () => {
  it('searches the company, its main e-mail/phone and the ids of companies that hold a matching person', () => {
    const f = buildSearchFilter('shazad', ['id-1', 'id-2']);
    expect(f).toContain('display_name.ilike.%shazad%');
    expect(f).toContain('main_email.ilike.%shazad%');
    expect(f).toContain('main_phone.ilike.%shazad%');
    expect(f).toContain('id.in.(id-1,id-2)');
  });

  it('works without any person match, and escapes characters that would break the filter', () => {
    expect(buildSearchFilter('abc', [])).not.toContain('id.in');
    const f = buildSearchFilter('a,b(c)%', []);
    expect(f).not.toMatch(/ilike\.%a,b/); // the comma is escaped, it cannot start a new condition
  });

  it('looks up contact people by name, email, phone and other-contact, de-duplicated and capped', async () => {
    let seenFilter = '';
    const many = Array.from({ length: 300 }, (_, i) => ({ prospect_id: `p${i % 250}` }));
    const admin = {
      from: () => ({ select: () => ({ or: (filter: string) => { seenFilter = filter; return { limit: async () => ({ data: many }) }; } }) }),
    };
    const ids = await prospectIdsMatchingContacts(admin, 'shazad');
    expect(seenFilter).toBe('name.ilike.%shazad%,email.ilike.%shazad%,phone.ilike.%shazad%,other_contact.ilike.%shazad%');
    expect(ids).toHaveLength(SEARCH_CONTACT_ID_CAP);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not search people for a one-letter query', async () => {
    const admin = { from: () => { throw new Error('should not query'); } };
    expect(await prospectIdsMatchingContacts(admin, 'a')).toEqual([]);
  });
});
