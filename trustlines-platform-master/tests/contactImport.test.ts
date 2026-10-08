import { describe, it, expect } from 'vitest';
import { allPhones, compareCompanies, compareNames, emailKey, parseLooseDate, phoneKey } from '@/lib/marketing/import/keys';
import { autoMapColumns, detectHeaderRow } from '@/lib/marketing/import/columns';
import { buildPeople, splitCityState } from '@/lib/marketing/import/records';
import { buildGroups } from '@/lib/marketing/import/group';
import { buildIndex, matchGroup } from '@/lib/marketing/import/match';
import { sanitizeGroup } from '@/lib/marketing/import/commit';
import { planMerge } from '@/lib/marketing/import/merge';
import type { ImportGroup, ImportPerson } from '@/lib/marketing/import/types';

const person = (over: Partial<ImportPerson>): ImportPerson => ({
  sources: ['t'], name: null, title: null, company: null, email: null, email2: null, phone: null, phone2: null,
  website: null, address: null, city: null, state: null, zip: null, businessTypes: [], notes: [], capturedBy: null, capturedAt: null, ...over,
});

describe('keys', () => {
  it('compares phones regardless of formatting / country prefix', () => {
    expect(phoneKey('(478) 365-4936')).toBe(phoneKey('+1 478-365-4936'));
    expect(phoneKey('4783654936')).toBe('4783654936');
    expect(phoneKey('123')).toBeNull();
  });
  it('takes the first valid email out of a messy cell', () => {
    expect(emailKey('Mail: Buyer@SunriseWholesale.co; other@x.com')).toBe('buyer@sunrisewholesale.co');
    expect(emailKey('no email here')).toBeNull();
  });
  it('splits several phones in one cell', () => {
    expect(allPhones('847-751-0563 / 847-555-0000')).toHaveLength(2);
  });
  it('knows when two person names can be the same human', () => {
    expect(compareNames('Rocky K', 'rocky  k.')).toBe('same');
    expect(compareNames('Alex C', 'Alex Cing')).toBe('compatible');
    expect(compareNames('Alex', 'Alex Cing')).toBe('partial');
    expect(compareNames('Alex Cing', 'Mike Roettgers')).toBeNull();
  });
  it('treats company legal suffixes as noise but does not merge unrelated names', () => {
    expect(compareCompanies('Kent Oil, Inc.', 'kent oil')).toBe('same');
    expect(compareCompanies('Shell', 'Shell Oil Products US')).toBe('similar');
    expect(compareCompanies('Kent', 'Kent Oil Co')).toBeNull(); // 4 letters: too short to trust
    expect(compareCompanies('Circle K', 'Circle K Stores')).toBe('similar');
    expect(compareCompanies('Royal Market', 'Royal Farms')).toBeNull();
  });
});

describe('column detection', () => {
  const whatsapp = [
    ['WhatsApp Leads Register • banner row', '', '', ''],
    ['No.', 'Contact Name', 'Company / Business', 'Phone Number', 'Email Address', 'City / State', 'Original Team Notes'],
    ['1', 'Darren Decatoire', 'Castle Gaming', '847-751-0563', 'dd@castle.com', 'Rolling Meadows, IL', 'wants signage'],
  ];
  it('skips a banner row above the real header', () => {
    expect(detectHeaderRow(whatsapp)).toBe(1);
  });
  it('maps columns by header name', () => {
    const maps = autoMapColumns(whatsapp[1], whatsapp.slice(2));
    const field = (h: string) => maps.find(m => m.header === h)?.field;
    expect(field('Contact Name')).toBe('full_name');
    expect(field('Company / Business')).toBe('company');
    expect(field('Phone Number')).toBe('phone');
    expect(field('Email Address')).toBe('email');
    expect(field('City / State')).toBe('city_state');
    expect(field('Original Team Notes')).toBe('notes');
    expect(field('No.')).toBe('ignore');
  });
  it('guesses e-mail/phone columns from their VALUES when the header says nothing', () => {
    const rows = [['a@x.com', '555-123-4567', 'Bob'], ['b@y.com', '555-222-3333', 'Ann'], ['c@z.com', '555-444-5555', 'Cy']];
    const maps = autoMapColumns(['Col A', 'Col B', 'Col C'], rows);
    expect(maps[0]).toMatchObject({ field: 'email', basis: 'content' });
    expect(maps[1]).toMatchObject({ field: 'phone', basis: 'content' });
    expect(maps[2].field).toBe('ignore');
  });
  it('does not turn a CRM export\'s generic "Name" into the person when Organization exists', () => {
    const maps = autoMapColumns(['Name', 'Type', 'Organization', 'Person', 'Primary Contact', 'Email', 'WhatsApp'], []);
    const field = (h: string) => maps.find(m => m.header === h)?.field;
    expect(field('Name')).toBe('ignore');
    expect(field('Organization')).toBe('company');
    expect(field('Primary Contact')).toBe('full_name');
    expect(field('Person')).toBe('full_name');
    expect(field('Type')).toBe('ignore');
    expect(field('WhatsApp')).toBe('ignore');
  });
});

describe('rows → people', () => {
  it('builds clean people, splitting city/state and several emails', () => {
    const rows = [
      ['Contact Name', 'Company', 'Email', 'Phone', 'City / State'],
      ['Jane Doe', 'Acme Fuel', 'jane@acme.com; jd@acme.com', '(555) 111-2222', 'Macon, GA'],
      ['', '', '', '', ''],
    ];
    const maps = autoMapColumns(rows[0], rows.slice(1));
    const { people, skippedEmpty } = buildPeople(rows, 0, maps, 'f');
    expect(people).toHaveLength(1);
    expect(skippedEmpty).toBe(1);
    expect(people[0]).toMatchObject({ name: 'Jane Doe', company: 'Acme Fuel', email: 'jane@acme.com', email2: 'jd@acme.com', city: 'Macon', state: 'GA' });
  });
  it('splitCityState keeps compound places whole', () => {
    expect(splitCityState('Milwaukee / Wauwatosa, WI')).toEqual({ city: 'Milwaukee / Wauwatosa', state: 'WI' });
    expect(splitCityState('Villa Rica, GA 30180')).toEqual({ city: 'Villa Rica', state: 'GA' });
  });
});

describe('de-duplication inside the files', () => {
  it('folds the same person seen in several rows/files into one', () => {
    const groups = buildGroups([
      person({ name: 'Rocky K', company: 'Serena Wholesale', email: 'buyer@sunrise.co', phone: '4783654936', sources: ['scan · row 2'], notes: ['a'] }),
      person({ name: 'Rocky K', company: 'Serena Wholesale', email: 'BUYER@sunrise.co', sources: ['scan · row 4'], notes: ['b'] }),
      person({ name: 'Rocky K', company: 'Serena Wholesale', phone: '+1 (478) 365-4936', sources: ['survey · row 9'] }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].people).toHaveLength(1);
    expect(groups[0].mergedRows).toBe(2);
    expect(groups[0].people[0].notes).toEqual(['a', 'b']);
    expect(groups[0].people[0].sources).toHaveLength(3);
  });
  it('keeps colleagues who share a company phone as separate Contacts of ONE company', () => {
    const groups = buildGroups([
      person({ name: 'Alex Cing', company: 'Roettgers Company, Inc.', phone: '414-555-0100' }),
      person({ name: 'Mike Roettgers', company: 'Roettgers Company', phone: '414-555-0100' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].people.map(p => p.name)).toEqual(['Alex Cing', 'Mike Roettgers']);
    expect(groups[0].warnings.join(' ')).toMatch(/share the phone/);
  });
  it('does not merge different people just because their names are similar', () => {
    const groups = buildGroups([
      person({ name: 'Atul Patel', company: 'Smokers Express', email: 'a@x.com' }),
      person({ name: 'Kalpesh Patel', company: 'Smokers Express', email: 'k@x.com' }),
    ]);
    expect(groups[0].people).toHaveLength(2);
  });
});

describe('matching against existing Contacts', () => {
  const idx = buildIndex(
    [
      { id: 'p1', display_name: 'Kent oil', organization_name: 'Kent oil', person_name: null, main_email: 'asturdivant@kentoil.com', main_phone: '4325204000', business_types: ['C-stores'], source_label: 'trade_fair' },
      { id: 'p2', display_name: 'Roettgers Company', organization_name: 'Roettgers Company', person_name: null, main_email: null, main_phone: null, business_types: [], source_label: null },
      { id: 'p3', display_name: 'Jazz Sohal', organization_name: null, person_name: 'Jazz Sohal', main_email: null, main_phone: '9164733348', business_types: [], source_label: null },
    ],
    [{ id: 'c1', prospect_id: 'p1', name: 'Adam Sturdivant', title: null, email: 'asturdivant@kentoil.com', phone: '4325204000', is_primary: true }],
  );
  const group = (over: Partial<ImportGroup>): ImportGroup => ({ id: 'g', company: null, people: [], mergedRows: 0, warnings: [], ...over });

  it('same email → strong', () => {
    const m = matchGroup(group({ company: 'The Kent Companies', people: [person({ name: 'Adam S', email: 'ASTURDIVANT@kentoil.com' })] }), idx);
    expect(m[0]).toMatchObject({ prospectId: 'p1', strength: 'strong' });
    expect(m[0].reasons[0]).toMatch(/Same email/);
  });
  it('same phone and matching name → strong; same phone but a stranger → only possible', () => {
    const strong = matchGroup(group({ people: [person({ name: 'Jazz Sohal', phone: '+1 916-473-3348' })] }), idx);
    expect(strong[0].strength).toBe('strong');
    const weak = matchGroup(group({ company: 'Other Co', people: [person({ name: 'Somebody Else', phone: '916-473-3348' })] }), idx);
    expect(weak[0].strength).toBe('possible');
  });
  it('same company name only → possible (maybe an extra contact for the same company)', () => {
    const m = matchGroup(group({ company: 'Roettgers Company, Inc.', people: [person({ name: 'Alex Cing' })] }), idx);
    expect(m[0]).toMatchObject({ prospectId: 'p2', strength: 'possible' });
  });
  it('nothing alike → no match', () => {
    expect(matchGroup(group({ company: 'Brand New LLC', people: [person({ name: 'Zed Zed', email: 'zed@new.com', phone: '2125550000' })] }), idx)).toEqual([]);
  });
});

describe('commit input is sanitised', () => {
  it('rejects unknown actions and clips oversized input', () => {
    expect(sanitizeGroup({ id: 'a', action: 'delete', people: [] })).toBeNull();
    const g = sanitizeGroup({ id: 'a', action: 'create', company: 'X'.repeat(500), people: [{ name: 'N'.repeat(500), notes: ['n'.repeat(9000)] }] });
    expect(g?.company?.length).toBe(200);
    expect(g?.people[0].name?.length).toBe(160);
    expect(g?.people[0].notes[0].length).toBe(8000);
  });
});

describe('captured date', () => {
  it('reads the date formats found in real exports', () => {
    expect(parseLooseDate('10/7/26 5:14 PM')?.slice(0, 10)).toMatch(/^2026-10-0[78]$/);
    expect(parseLooseDate('2026-10-07')?.slice(0, 10)).toMatch(/^2026-10-0[67]$/);
    expect(parseLooseDate('10/7/26 1:')).not.toBeNull(); // cut-off time: the date still counts
    expect(parseLooseDate('Oct 7, 2026')).not.toBeNull();
    expect(parseLooseDate('46302')).not.toBeNull(); // Excel serial day
  });
  it('refuses things that are not clearly dates', () => {
    for (const v of ['', 'hello', '13/45/26', '4783654936', '12']) expect(parseLooseDate(v)).toBeNull();
  });
  it('maps a "Captured Date" column and keeps the EARLIEST date when rows are folded together', () => {
    const rows = [
      ['FirstName', 'LastName', 'Company', 'Email', 'Captured Date'],
      ['Rocky', 'K', 'Serena', 'r@s.com', '10/7/26 5:14 PM'],
      ['Rocky', 'K', 'Serena', 'r@s.com', '10/6/26 9:00 AM'],
    ];
    const maps = autoMapColumns(rows[0], rows.slice(1));
    expect(maps.find(m => m.header === 'Captured Date')?.field).toBe('captured_date');
    const groups = buildGroups(buildPeople(rows, 0, maps, 'f').people);
    expect(groups).toHaveLength(1);
    expect(new Date(groups[0].people[0].capturedAt!).getUTCDate()).toBe(6);
  });
});

describe('notes keep every mapped column, in file order', () => {
  it('adds one labelled line per notes column, left to right', () => {
    const rows = [
      ['Company', 'Zebra Note', 'Notes', 'Alpha Info'],
      ['Acme', 'z-value', 'n-value', 'a-value'],
    ];
    const maps = autoMapColumns(rows[0], rows.slice(1)).map(m => (['Zebra Note', 'Alpha Info'].includes(m.header) ? { ...m, field: 'notes' as const } : m));
    const { people } = buildPeople(rows, 0, maps, 'f');
    expect(people[0].notes).toEqual(['Zebra Note: z-value', 'Notes: n-value', 'Alpha Info: a-value']);
  });
});

describe('merge plan — the existing Contact always wins', () => {
  const target = { organizationName: 'Kent oil', email: 'asturdivant@kentoil.com', phone: '4325204000', website: null, businessTypes: ['C-stores'] };
  const adam = { id: 'c1', name: 'Adam Sturdivant', title: null, email: 'asturdivant@kentoil.com', phone: '4325204000', otherContact: null };

  it('fills only EMPTY fields and adds new people and business types', () => {
    const plan = planMerge(target, [adam], {
      company: 'Kent oil',
      people: [
        person({ name: 'Adam Sturdivant', title: 'Vice President', email: 'ASTURDIVANT@kentoil.com', website: 'kentoil.com', businessTypes: ['Retailer/Fuel Marketer'] }),
        person({ name: 'Bob Kent', email: 'bob@kentoil.com' }),
      ],
    });
    expect(plan.prospectPatch).toEqual({ website: 'kentoil.com', business_types: ['C-stores', 'Retailer/Fuel Marketer'] });
    expect(plan.people[0].match?.id).toBe('c1');
    expect(plan.people[0].fill).toEqual({ title: 'Vice President' });
    expect(plan.people[1].match).toBeNull(); // Bob is added as a new person
    expect(plan.summary.newPeople).toEqual(['Bob Kent']);
  });

  it('never overwrites a filled value — a different one is kept for the note instead', () => {
    const plan = planMerge(target, [{ ...adam, title: 'Owner' }], {
      company: 'The Kent Companies',
      people: [person({ name: 'Adam Sturdivant', title: 'Vice President', phone: '432-528-9469', email: 'adam@other.com' })],
    });
    expect(plan.prospectPatch.main_phone).toBeUndefined();
    expect(plan.prospectPatch.main_email).toBeUndefined();
    expect(plan.people[0].fill).toEqual({});
    expect(plan.differences).toContain('Phone: 432-528-9469');
    expect(plan.differences).toContain('Company name in the file: The Kent Companies');
    expect(plan.people[0].differences).toEqual(expect.arrayContaining(['Title: Vice President', 'Phone: 432-528-9469', 'Email: adam@other.com']));
  });

  it('keeps the alternate phone/email of a matched person without overwriting', () => {
    const plan = planMerge(target, [adam], { company: 'Kent oil', people: [person({ name: 'Adam Sturdivant', phone2: '432-111-2222', email2: 'a2@kentoil.com' })] });
    expect(plan.people[0].fill.other_contact).toBe('a2@kentoil.com · 432-111-2222');
    const again = planMerge(target, [{ ...adam, otherContact: 'someone else' }], { company: 'Kent oil', people: [person({ name: 'Adam Sturdivant', phone2: '432-111-2222' })] });
    expect(again.people[0].differences[0]).toMatch(/Alternate contact/);
  });
});
