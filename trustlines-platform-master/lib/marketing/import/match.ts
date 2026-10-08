import { companyKey, compareCompanies, compareNames, emailKey, nameKey, phoneKey } from './keys';
import type { ExistingContactLite, ExistingMatch, ImportGroup, MatchStrength } from './types';

// Compares import groups with the Prospects/Contacts already in the CRM. Pure: the server loads
// the rows, this decides what looks like what.

export interface ExistingProspectRow {
  id: string;
  display_name: string | null;
  organization_name: string | null;
  person_name: string | null;
  main_email: string | null;
  main_phone: string | null;
  business_types: string[] | null;
  source_label: string | null;
  website?: string | null;
  created_at?: string | null;
  external_created_at?: string | null;
}

export interface ExistingContactRow {
  id: string;
  prospect_id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  other_contact?: string | null;
  is_primary: boolean;
}

export interface ExistingIndex {
  prospects: Map<string, ExistingProspectRow>;
  contacts: Map<string, ExistingContactRow[]>;
  byEmail: Map<string, Set<string>>;
  byPhone: Map<string, Set<string>>;
  byCompany: Map<string, Set<string>>;
  byPerson: Map<string, Set<string>>;
}

function add(map: Map<string, Set<string>>, key: string | null, id: string) {
  if (!key) return;
  const set = map.get(key) ?? new Set<string>();
  set.add(id);
  map.set(key, set);
}

export function buildIndex(prospects: ExistingProspectRow[], contacts: ExistingContactRow[]): ExistingIndex {
  const idx: ExistingIndex = {
    prospects: new Map(prospects.map(p => [p.id, p])), contacts: new Map(),
    byEmail: new Map(), byPhone: new Map(), byCompany: new Map(), byPerson: new Map(),
  };
  for (const p of prospects) {
    add(idx.byEmail, emailKey(p.main_email), p.id);
    add(idx.byPhone, phoneKey(p.main_phone), p.id);
    add(idx.byCompany, companyKey(p.organization_name), p.id);
    const person = nameKey(p.person_name);
    if (person && person.includes(' ')) add(idx.byPerson, person, p.id);
  }
  for (const c of contacts) {
    const list = idx.contacts.get(c.prospect_id) ?? [];
    list.push(c);
    idx.contacts.set(c.prospect_id, list);
    add(idx.byEmail, emailKey(c.email), c.prospect_id);
    add(idx.byPhone, phoneKey(c.phone), c.prospect_id);
    const person = nameKey(c.name);
    if (person && person.includes(' ')) add(idx.byPerson, person, c.prospect_id);
  }
  return idx;
}

const rank: Record<MatchStrength, number> = { strong: 2, possible: 1 };

/** Existing Prospects that look like this group, strongest first (at most 3). */
export function matchGroup(group: ImportGroup, idx: ExistingIndex): ExistingMatch[] {
  const candidates = new Map<string, { strength: MatchStrength; reasons: string[] }>();
  const note = (id: string, strength: MatchStrength, reason: string) => {
    const cur = candidates.get(id) ?? { strength: 'possible' as MatchStrength, reasons: [] };
    if (rank[strength] > rank[cur.strength]) cur.strength = strength;
    if (!cur.reasons.includes(reason)) cur.reasons.push(reason);
    candidates.set(id, cur);
  };
  const peopleOf = (id: string): string[] => {
    const p = idx.prospects.get(id);
    return [...(idx.contacts.get(id) ?? []).map(c => c.name), p?.person_name ?? ''].filter(Boolean);
  };

  for (const person of group.people) {
    // 1. e-mail — the strongest signal
    for (const e of [person.email, person.email2]) {
      const k = emailKey(e);
      for (const id of (k ? idx.byEmail.get(k) : undefined) ?? []) note(id, 'strong', `Same email: ${k}`);
    }
    // 2. phone — strong when the person or company also lines up, otherwise just a lead
    for (const ph of [person.phone, person.phone2]) {
      const k = phoneKey(ph);
      for (const id of (k ? idx.byPhone.get(k) : undefined) ?? []) {
        const p = idx.prospects.get(id);
        const nameOk = peopleOf(id).some(n => compareNames(person.name, n) !== null);
        const companyOk = !!person.company && compareCompanies(person.company, p?.organization_name) !== null;
        if (nameOk || companyOk) note(id, 'strong', `Same phone: ${ph}`);
        else note(id, 'possible', `Same phone (${ph}) but a different name/company`);
      }
    }
    // 3. same person name
    const pk = nameKey(person.name);
    if (pk && pk.includes(' ')) {
      for (const id of idx.byPerson.get(pk) ?? []) note(id, 'possible', `Same person name: ${person.name}`);
    }
  }

  // 4. company name
  const ck = companyKey(group.company);
  if (ck) {
    for (const id of idx.byCompany.get(ck) ?? []) note(id, 'possible', `Same company name: ${group.company}`);
    if (ck.length >= 5) {
      for (const [key, ids] of idx.byCompany) {
        if (key !== ck && (key.includes(ck) || ck.includes(key)) && Math.min(key.length, ck.length) >= 5) {
          for (const id of ids) note(id, 'possible', `Similar company name: ${idx.prospects.get(id)?.organization_name}`);
        }
      }
    }
  }

  return [...candidates.entries()]
    .map(([id, c]) => {
      const p = idx.prospects.get(id)!;
      const contacts: ExistingContactLite[] = (idx.contacts.get(id) ?? []).map(c2 => ({
        id: c2.id, name: c2.name, title: c2.title, email: c2.email, phone: c2.phone, otherContact: c2.other_contact ?? null, isPrimary: c2.is_primary,
      }));
      return {
        prospectId: id,
        displayName: p.display_name ?? p.organization_name ?? p.person_name ?? '(no name)',
        organizationName: p.organization_name, personName: p.person_name,
        email: p.main_email, phone: p.main_phone,
        businessTypes: p.business_types ?? [], sourceLabel: p.source_label,
        addedAt: p.external_created_at ?? p.created_at ?? null,
        website: p.website ?? null,
        strength: c.strength, reasons: c.reasons, contacts,
      } satisfies ExistingMatch;
    })
    .sort((a, b) => rank[b.strength] - rank[a.strength] || b.reasons.length - a.reasons.length)
    .slice(0, 3);
}
