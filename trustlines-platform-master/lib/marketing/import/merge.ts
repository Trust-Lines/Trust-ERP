import { compareNames, emailKey, nameKey, phoneKey } from './keys';
import type { ImportPerson } from './types';

// "Merge into the existing Contact" — decided in ONE place so the preview the user sees on screen
// and what the server then writes can never disagree.
//
// Rules:
//  • The Contact that is already in the CRM wins. Nothing it holds is overwritten or removed.
//  • A value is written only into an EMPTY field. When the file has a DIFFERENT value for a field
//    that is already filled, the existing one stays and the file's value is recorded in the
//    Activity note ("Different in the imported file…") so nothing from the file is lost.
//  • A person who is not on the Contact yet is added as a new Contact person.
//  • A person who is already there is matched (same email / same phone + compatible name / same
//    name) and only their empty fields are filled. A WhatsApp "Yes" is added; a "No" never
//    removes an existing tick.

export interface MergeTarget {
  organizationName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  businessTypes: string[];
  xNote?: string | null;
  sourceDetail?: string | null;
}

export interface MergeContact {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  otherContact?: string | null;
  whatsapp?: boolean;
  linkedin?: string | null;
  company2Phone?: string | null;
}

/** Keys are the real `prospect_contacts` column names so the server can write them as they are. */
export interface ContactFill {
  title?: string; email?: string; phone?: string; other_contact?: string;
  whatsapp?: boolean; linkedin_url?: string; company2_phone?: string;
}

export interface MergePersonPlan {
  person: ImportPerson;
  /** Existing Contact person this row is the same human as, or null → a new person is added. */
  match: MergeContact | null;
  fill: ContactFill;
  /** Values in the file that clash with filled fields (kept out of the structured fields, put in the note). */
  differences: string[];
}

export interface MergePlan {
  prospectPatch: { main_email?: string; main_phone?: string; website?: string; business_types?: string[]; x_note?: string; source_detail?: string };
  people: MergePersonPlan[];
  /** Company-level clashes (company name, main phone/email/website). */
  differences: string[];
  /** Plain-language lines for the confirmation shown before merging. */
  summary: { adds: string[]; newPeople: string[]; keeps: string[] };
}

/** Everything extra we know about how to reach this person: other contact, 2nd email, 2nd phone. */
export const otherContactOf = (p: ImportPerson): string | null =>
  [p.otherContact, p.email2, p.phone2].filter((v): v is string => !!v).join(' · ') || null;

const sameEmail = (a?: string | null, b?: string | null) => !!emailKey(a) && emailKey(a) === emailKey(b);
const samePhone = (a?: string | null, b?: string | null) => !!phoneKey(a) && phoneKey(a) === phoneKey(b);
const sameText = (a?: string | null, b?: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

export function findContactFor(person: ImportPerson, contacts: MergeContact[]): MergeContact | null {
  return contacts.find(c =>
    sameEmail(person.email, c.email)
    || (samePhone(person.phone, c.phone) && (!person.name || compareNames(person.name, c.name) !== null))
    || (!!person.name && nameKey(person.name) === nameKey(c.name))) ?? null;
}

export function planMerge(target: MergeTarget, contacts: MergeContact[], g: { company: string | null; people: ImportPerson[] }): MergePlan {
  const prospectPatch: MergePlan['prospectPatch'] = {};
  const differences: string[] = [];
  const first = <T,>(pick: (p: ImportPerson) => T | null | undefined) => g.people.map(pick).find(v => !!v) ?? null;

  // company-level values: fill when empty, otherwise note the clash
  const email = first(p => p.email);
  const phone = first(p => p.phone);
  const website = first(p => p.website);
  const xNote = first(p => p.xNote);
  const sourceInfo = first(p => p.sourceInfo);
  if (email) { if (!target.email) prospectPatch.main_email = email; else if (!sameEmail(email, target.email)) differences.push(`Email: ${email}`); }
  if (phone) { if (!target.phone) prospectPatch.main_phone = phone; else if (!samePhone(phone, target.phone)) differences.push(`Phone: ${phone}`); }
  if (website) { if (!target.website) prospectPatch.website = website; else if (!sameText(target.website, website)) differences.push(`Website: ${website}`); }
  if (xNote) { if (!target.xNote) prospectPatch.x_note = xNote; else if (!target.xNote.includes(xNote)) differences.push(`X-note: ${xNote}`); }
  if (sourceInfo) { if (!target.sourceDetail) prospectPatch.source_detail = sourceInfo; else if (!sameText(target.sourceDetail, sourceInfo)) differences.push(`Source info: ${sourceInfo}`); }
  if (g.company && target.organizationName && !sameText(g.company, target.organizationName)) {
    differences.push(`Company name in the file: ${g.company}`);
  }
  const types = [...new Set(g.people.flatMap(p => p.businessTypes))].filter(t => !target.businessTypes.some(x => x.toLowerCase() === t.toLowerCase()));
  if (types.length) prospectPatch.business_types = [...target.businessTypes, ...types];

  const people: MergePersonPlan[] = g.people.map(person => {
    const match = findContactFor(person, contacts);
    const fill: ContactFill = {};
    const diff: string[] = [];
    if (match) {
      if (person.title) { if (!match.title) fill.title = person.title; else if (!sameText(match.title, person.title)) diff.push(`Title: ${person.title}`); }
      if (person.email) { if (!match.email) fill.email = person.email; else if (!sameEmail(person.email, match.email)) diff.push(`Email: ${person.email}`); }
      if (person.phone) { if (!match.phone) fill.phone = person.phone; else if (!samePhone(person.phone, match.phone)) diff.push(`Phone: ${person.phone}`); }
      if (person.linkedin) { if (!match.linkedin) fill.linkedin_url = person.linkedin; else if (!sameText(match.linkedin, person.linkedin)) diff.push(`LinkedIn: ${person.linkedin}`); }
      if (person.company2Phone) { if (!match.company2Phone) fill.company2_phone = person.company2Phone; else if (!samePhone(match.company2Phone, person.company2Phone)) diff.push(`Company 2 phone: ${person.company2Phone}`); }
      if (person.whatsapp === true && !match.whatsapp) fill.whatsapp = true;
      const extra = otherContactOf(person);
      if (extra) { if (!match.otherContact) fill.other_contact = extra; else if (!match.otherContact.includes(extra)) diff.push(`Alternate contact: ${extra}`); }
    }
    return { person, match, fill, differences: diff };
  });

  const labels: Record<string, string> = { other_contact: 'alternate contact', linkedin_url: 'LinkedIn', company2_phone: 'company 2 phone', whatsapp: 'WhatsApp' };
  const adds: string[] = [];
  if (prospectPatch.main_email) adds.push(`email ${prospectPatch.main_email}`);
  if (prospectPatch.main_phone) adds.push(`phone ${prospectPatch.main_phone}`);
  if (prospectPatch.website) adds.push(`website ${prospectPatch.website}`);
  if (prospectPatch.x_note) adds.push('X-note');
  if (prospectPatch.source_detail) adds.push('source info');
  if (types.length) adds.push(`business type ${types.join(', ')}`);
  for (const p of people) {
    const bits = Object.entries(p.fill).map(([k, v]) => `${labels[k] ?? k}${typeof v === 'boolean' ? '' : ` ${v}`}`);
    if (bits.length && p.match) adds.push(`${p.match.name}: ${bits.join(', ')}`);
  }
  const newPeople = people.filter(p => !p.match).map(p => p.person.name ?? p.person.email ?? p.person.phone ?? 'Unnamed contact');
  const keeps = [...differences, ...people.flatMap(p => p.differences.map(d => `${p.match?.name ?? p.person.name ?? 'Contact'} — ${d}`))];
  return { prospectPatch, people, differences, summary: { adds, newPeople, keeps } };
}
