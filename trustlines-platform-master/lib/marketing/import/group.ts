import { compareCompanies, compareNames, emailKey, nameKey, phoneKey } from './keys';
import type { ImportGroup, ImportPerson } from './types';

const personEmails = (p: ImportPerson) => [p.email, p.email2].map(emailKey).filter((e): e is string => !!e);
const personPhones = (p: ImportPerson) => [p.phone, p.phone2].map(phoneKey).filter((e): e is string => !!e);

/** Do two rows describe the SAME human? Strong keys first, then a phone/name combination. */
export function samePerson(a: ImportPerson, b: ImportPerson): boolean {
  if (personEmails(a).some(e => personEmails(b).includes(e))) return true;

  const sharedPhone = personPhones(a).some(p => personPhones(b).includes(p));
  if (sharedPhone) {
    const n = compareNames(a.name, b.name);
    // same phone + compatible/same name (or one side has no name) → same person.
    // same phone + two clearly different names → colleagues sharing the company line, NOT duplicates.
    if (n === 'same' || n === 'compatible' || n === 'partial') return true;
    if (!a.name || !b.name) return true;
  }

  // same name AND same company, no other key to compare (e.g. a person with no email/phone in one file)
  if (a.name && b.name && nameKey(a.name) === nameKey(b.name) && compareCompanies(a.company, b.company)) return true;
  return false;
}

function fold<T>(into: T | null, from: T | null): T | null {
  return into === null || into === '' ? from : into;
}

export function mergePerson(into: ImportPerson, from: ImportPerson): ImportPerson {
  const notes = [...into.notes];
  for (const n of from.notes) if (!notes.includes(n)) notes.push(n);
  const emails = [...new Set([...personEmails(into), ...personEmails(from)])];
  const phoneList = [into.phone, into.phone2, from.phone, from.phone2].filter((p): p is string => !!p)
    .filter((p, i, arr) => arr.findIndex(o => phoneKey(o) === phoneKey(p)) === i);
  return {
    sources: [...into.sources, ...from.sources],
    name: (into.name && from.name && from.name.length > into.name.length && compareNames(into.name, from.name) !== null) ? from.name : fold(into.name, from.name),
    title: fold(into.title, from.title),
    company: fold(into.company, from.company),
    email: emails[0] ?? null,
    email2: emails[1] ?? null,
    phone: phoneList[0] ?? null,
    phone2: phoneList[1] ?? null,
    website: fold(into.website, from.website),
    address: fold(into.address, from.address),
    city: fold(into.city, from.city),
    state: fold(into.state, from.state),
    zip: fold(into.zip, from.zip),
    businessTypes: [...new Set([...into.businessTypes, ...from.businessTypes])],
    notes,
    capturedBy: fold(into.capturedBy, from.capturedBy),
    capturedAt: [into.capturedAt, from.capturedAt].filter((d): d is string => !!d).sort()[0] ?? null,
  };
}

/**
 * 1. folds repeated rows of the same person into one (across files too), then
 * 2. groups people by company — each group becomes ONE Prospect with several Contacts; people with
 *    no company stay on their own.
 */
export function buildGroups(rows: ImportPerson[]): ImportGroup[] {
  const people: ImportPerson[] = [];
  const mergedInto: number[] = []; // how many raw rows each merged person absorbed
  for (const row of rows) {
    const at = people.findIndex(p => samePerson(p, row));
    if (at >= 0) { people[at] = mergePerson(people[at], row); mergedInto[at] = (mergedInto[at] ?? 0) + 1; }
    else { people.push(row); mergedInto.push(0); }
  }

  const groups: ImportGroup[] = [];
  people.forEach((person, i) => {
    const target = person.company
      ? groups.find(g => g.company && compareCompanies(g.company, person.company) === 'same')
      : undefined;
    if (target) {
      target.people.push(person);
      target.mergedRows += mergedInto[i];
    } else {
      groups.push({ id: `g${groups.length + 1}`, company: person.company, people: [person], mergedRows: mergedInto[i], warnings: [] });
    }
  });

  for (const g of groups) {
    for (let a = 0; a < g.people.length; a++) {
      for (let b = a + 1; b < g.people.length; b++) {
        const shared = personPhones(g.people[a]).find(p => personPhones(g.people[b]).includes(p));
        if (shared) g.warnings.push(`${g.people[a].name ?? 'A contact'} and ${g.people[b].name ?? 'another contact'} share the phone ${g.people[a].phone}`);
      }
    }
    if (g.people.every(p => !p.email && !p.phone)) g.warnings.push('No email or phone in any row');
    const names = g.people.filter(p => p.name).length;
    if (!g.company && names === 0) g.warnings.push('No company and no person name');
  }
  return groups;
}

