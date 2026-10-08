import { allEmails, allPhones } from './keys';
import type { ColumnMapping, ImportField } from './types';

// Spreadsheets arrive in any layout, so columns are never assumed: every header is matched against
// known synonyms, and — for columns whose header says nothing — the VALUES are inspected (does it
// look like an e-mail / phone?). The user can still override any column in the UI.

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

// score: higher wins when two columns want the same field.
const SYNONYMS: { field: ImportField; score: number; keys: string[] }[] = [
  { field: 'first_name', score: 3, keys: ['firstname', 'first', 'givenname', 'fname', 'forename'] },
  { field: 'last_name', score: 3, keys: ['lastname', 'last', 'surname', 'lname', 'familyname'] },
  { field: 'full_name', score: 3, keys: ['fullname', 'contactname', 'primarycontact', 'leadname', 'customername', 'personname', 'contactperson'] },
  { field: 'full_name', score: 2, keys: ['person', 'contact', 'attendee', 'visitor'] },
  { field: 'full_name', score: 1, keys: ['name'] },
  { field: 'title', score: 3, keys: ['title', 'jobtitle', 'position', 'role', 'roleposition', 'designation', 'jobposition'] },
  { field: 'company', score: 3, keys: ['company', 'companyname', 'organization', 'organisation', 'org', 'businessname', 'employer', 'companybusiness', 'store', 'storename', 'brand', 'brandname'] },
  { field: 'company', score: 1, keys: ['badgecompanyfull', 'business'] },
  { field: 'email', score: 3, keys: ['email', 'emailaddress', 'mail', 'primaryemail', 'email1', 'workemail', 'eposta'] },
  { field: 'email2', score: 3, keys: ['additionalemail', 'alternateemail', 'alternateemails', 'email2', 'secondaryemail', 'altemail', 'otheremail'] },
  { field: 'phone', score: 3, keys: ['phone', 'phonenumber', 'telephone', 'tel', 'mobile', 'mobilephone', 'cell', 'cellphone', 'phone1', 'primaryphone', 'workphone', 'telefon', 'gsm'] },
  { field: 'phone2', score: 3, keys: ['additionalphone', 'alternatephone', 'alternatephonenumbers', 'phone2', 'secondaryphone', 'altphone', 'otherphone'] },
  { field: 'website', score: 3, keys: ['website', 'web', 'url', 'site', 'domain', 'homepage'] },
  { field: 'address', score: 3, keys: ['address', 'streetaddress', 'street', 'address1', 'addressline1', 'businessaddress', 'storeaddress'] },
  { field: 'city', score: 3, keys: ['city', 'town'] },
  { field: 'state', score: 3, keys: ['state', 'statecode', 'province', 'stateprovince'] },
  { field: 'zip', score: 3, keys: ['zip', 'zipcode', 'postalcode', 'postcode'] },
  { field: 'city_state', score: 3, keys: ['citystate', 'citystatezip', 'location', 'cityregion'] },
  { field: 'business_type', score: 3, keys: ['businesstype', 'businesstypes', 'industry', 'category', 'storeclassification', 'segment', 'companytype'] },
  { field: 'notes', score: 3, keys: ['notes', 'note', 'comments', 'comment', 'remarks', 'activities', 'activity', 'projectdetails', 'originalteamnotes', 'description', 'badgescannotes', 'followup'] },
  { field: 'captured_date', score: 3, keys: ['captureddate', 'datecaptured', 'capturedat', 'dateadded', 'added', 'addedon', 'createddate', 'createdat', 'created', 'datecreated', 'timestamp', 'scanneddate', 'date'] },
  { field: 'captured_by', score: 3, keys: ['leadorigin', 'leadinformationprovidedby', 'badgescannedby', 'leadprovidedby', 'capturedby', 'scannedby', 'enteredby', 'owner', 'repname', 'salesrep'] },
];

/** Headers that sound like a field but are known to be something else in the files we have seen. */
const NEVER_MAP = new Set(['type', 'status', 'source', 'archived', 'updated', 'info', 'whatsapp', 'no', 'id', 'leadid', 'badgeid', 'leadtype', 'rating', 'collateral']);

function headerCandidates(header: string): { field: ImportField; score: number }[] {
  const k = norm(header);
  if (!k || NEVER_MAP.has(k)) return [];
  const out: { field: ImportField; score: number }[] = [];
  for (const s of SYNONYMS) if (s.keys.includes(k)) out.push({ field: s.field, score: s.score });
  return out;
}

/** Index of the header row: the first rows are scanned and the one with the most recognisable headers wins. */
export function detectHeaderRow(rows: string[][]): number {
  let best = -1;
  let bestScore = 0;
  const limit = Math.min(rows.length, 15);
  for (let i = 0; i < limit; i++) {
    const cells = rows[i] ?? [];
    const filled = cells.filter(c => String(c ?? '').trim()).length;
    if (filled < 2) continue; // banner / blank rows
    const score = cells.reduce((n, c) => n + (headerCandidates(String(c)).length ? 1 : 0), 0);
    if (score > bestScore) { best = i; bestScore = score; }
  }
  if (best >= 0) return best;
  // Nothing recognisable: take the first row that has several filled cells.
  for (let i = 0; i < limit; i++) if ((rows[i] ?? []).filter(c => String(c ?? '').trim()).length >= 2) return i;
  return 0;
}

function sampleOf(rows: string[][], col: number, max = 4): string[] {
  const out: string[] = [];
  for (const r of rows) {
    const v = String(r[col] ?? '').trim();
    if (v && !out.includes(v)) out.push(v.length > 60 ? `${v.slice(0, 57)}…` : v);
    if (out.length >= max) break;
  }
  return out;
}

function contentGuess(values: string[]): ImportField | null {
  const filled = values.map(v => v.trim()).filter(Boolean);
  if (filled.length < 3) return null;
  const share = (pred: (v: string) => boolean) => filled.filter(pred).length / filled.length;
  if (share(v => allEmails(v).length > 0) >= 0.6) return 'email';
  if (share(v => allPhones(v).length > 0 && /^[\d\s()+.\-/;]+$/.test(v)) >= 0.6) return 'phone';
  return null;
}

/**
 * Decides what each column is. `dataRows` = the rows below the header. Duplicate claims are resolved
 * by score (and, for e-mail/phone, the second column becomes the "alternate").
 */
export function autoMapColumns(headers: string[], dataRows: string[][]): ColumnMapping[] {
  const mappings: ColumnMapping[] = headers.map((header, index) => ({
    index, header: String(header ?? '').trim() || `Column ${index + 1}`, field: 'ignore' as ImportField,
    basis: 'none' as const, sample: sampleOf(dataRows, index),
  }));

  // 1. header based claims
  const claims = new Map<ImportField, { index: number; score: number }[]>();
  mappings.forEach(m => {
    const best = headerCandidates(m.header).sort((a, b) => b.score - a.score)[0];
    if (best) {
      const list = claims.get(best.field) ?? [];
      list.push({ index: m.index, score: best.score });
      claims.set(best.field, list);
    }
  });

  // A generic "Name" column is the person only when the sheet has no better person/company column
  // (in CRM exports it is the display name — the company for organisations).
  const hasCompany = (claims.get('company') ?? []).some(c => c.score >= 3);
  const hasStrongPerson = ['full_name', 'first_name'].some(f => (claims.get(f as ImportField) ?? []).some(c => c.score >= 2));
  if (hasCompany || hasStrongPerson) {
    const names = (claims.get('full_name') ?? []).filter(c => c.score > 1);
    if (names.length) claims.set('full_name', names); else claims.delete('full_name');
  }

  const taken = new Set<number>();
  for (const [field, list] of claims) {
    list.sort((a, b) => b.score - a.score || a.index - b.index);
    // Several columns may feed these: notes are concatenated, and for names the first non-empty
    // one (best-scored header first) wins per row — "Primary Contact" for companies, "Person" for individuals.
    const multi = field === 'notes' || field === 'business_type' || field === 'captured_by' || field === 'full_name';
    const chosen = multi ? list : [list[0]];
    chosen.forEach(c => {
      mappings[c.index].field = field;
      mappings[c.index].basis = 'header';
      taken.add(c.index);
    });
    // extra e-mail / phone columns become the alternate one
    if (!multi && list.length > 1 && (field === 'email' || field === 'phone')) {
      const alt: ImportField = field === 'email' ? 'email2' : 'phone2';
      const free = list.slice(1).find(() => !(claims.get(alt) ?? []).length);
      if (free) { mappings[free.index].field = alt; mappings[free.index].basis = 'header'; taken.add(free.index); }
    }
  }

  // 2. content based, for columns the header could not explain
  const have = (f: ImportField) => mappings.some(m => m.field === f);
  mappings.forEach(m => {
    if (m.basis !== 'none' || NEVER_MAP.has(norm(m.header))) return;
    const guess = contentGuess(dataRows.map(r => String(r[m.index] ?? '')));
    if (!guess) return;
    const target: ImportField = guess === 'email' ? (have('email') ? (have('email2') ? 'ignore' : 'email2') : 'email')
      : (have('phone') ? (have('phone2') ? 'ignore' : 'phone2') : 'phone');
    if (target !== 'ignore') { m.field = target; m.basis = 'content'; }
  });

  // 3. a WhatsApp / yes-no style column must never be treated as a phone
  mappings.forEach(m => {
    if (norm(m.header) === 'whatsapp') { m.field = 'ignore'; m.basis = 'none'; }
  });

  return mappings;
}

/** Header-name score for a field (0 when the header doesn't suggest it) — used to order several name columns. */
export function headerScore(header: string, field: ImportField): number {
  return headerCandidates(header).find(c => c.field === field)?.score ?? 0;
}
