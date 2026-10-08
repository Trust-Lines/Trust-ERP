import { allEmails, allPhones, emailKey, parseLooseDate } from './keys';
import { headerScore } from './columns';
import type { ColumnMapping, ImportField, ImportPerson } from './types';

// Collapses every kind of blank (tabs, non-breaking spaces…) but keeps line breaks — notes are multi-line.
const clean = (v: unknown): string => String(v ?? '').replace(/[^\S\n]+/g, ' ').trim();

/** "Rolling Meadows, IL" → { city, state }; "Milwaukee / Wauwatosa, WI" keeps the whole place as city. */
export function splitCityState(value: string): { city: string | null; state: string | null } {
  const v = clean(value);
  if (!v) return { city: null, state: null };
  const m = v.match(/^(.*?)[,\s]+([A-Za-z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/);
  if (m && m[1].trim() && /^[A-Z]{2}$/.test(m[2].toUpperCase())) return { city: m[1].trim().replace(/[,\s]+$/, ''), state: m[2].toUpperCase() };
  return { city: v, state: null };
}

function splitList(value: string): string[] {
  return [...new Set(value.split(/[|;]|,(?!\s*(?:inc|llc|ltd)\b)/i).map(s => s.trim()).filter(Boolean))];
}

export interface BuildResult { people: ImportPerson[]; skippedEmpty: number }

/**
 * Turns the rows under the header into cleaned people, following the column mapping.
 * `fileLabel` is only used to tell the user where a row came from.
 */
export function buildPeople(rows: string[][], headerRow: number, mappings: ColumnMapping[], fileLabel: string): BuildResult {
  const cols = (field: ImportField) => mappings.filter(m => m.field === field).map(m => m.index);
  const ordered = (field: ImportField) => mappings
    .filter(m => m.field === field)
    .sort((a, b) => headerScore(b.header, field) - headerScore(a.header, field) || a.index - b.index)
    .map(m => m.index);

  const people: ImportPerson[] = [];
  let skippedEmpty = 0;

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const cell = (i: number) => clean(row[i]);
    const firstOf = (field: ImportField) => {
      for (const i of ordered(field)) { const v = cell(i); if (v) return v; }
      return null;
    };
    if (!row.some(c => clean(c))) { skippedEmpty++; continue; }

    const first = firstOf('first_name');
    const last = firstOf('last_name');
    const name = [first, last].filter(Boolean).join(' ').trim() || firstOf('full_name');

    const emails = [...cols('email'), ...cols('email2')].flatMap(i => allEmails(row[i] ?? ''));
    const phones = [...cols('phone'), ...cols('phone2')].flatMap(i => allPhones(clean(row[i]))
      .map(p => p)).filter((p, i, arr) => arr.findIndex(o => o.replace(/\D/g, '') === p.replace(/\D/g, '')) === i);

    let { city, state } = { city: firstOf('city'), state: firstOf('state') };
    const cityState = firstOf('city_state');
    if (cityState && (!city || !state)) {
      const split = splitCityState(cityState);
      city = city ?? split.city;
      state = state ?? split.state;
    }

    // File order (left to right), never re-sorted: the Activity note reads like the spreadsheet row.
    const notesCols = cols('notes');
    const notes = notesCols
      .map(i => {
        const v = String(row[i] ?? '').replace(/\r/g, '').trim();
        if (!v) return '';
        const header = mappings.find(m => m.index === i)?.header ?? '';
        return notesCols.length > 1 ? `${header}: ${v}` : v;
      })
      .filter(Boolean)
      .map(n => (n.length > 8000 ? `${n.slice(0, 7997)}…` : n));

    const person: ImportPerson = {
      sources: [`${fileLabel} · row ${r + 1}`],
      name: name && !emailKey(name) ? name : null,
      title: firstOf('title'),
      company: firstOf('company'),
      email: emails[0] ?? null,
      email2: emails[1] ?? null,
      phone: phones[0] ?? null,
      phone2: phones[1] ?? null,
      website: firstOf('website'),
      address: firstOf('address'),
      city, state,
      zip: firstOf('zip'),
      businessTypes: [...new Set(cols('business_type').flatMap(i => splitList(cell(i))))],
      notes,
      capturedBy: firstOf('captured_by'),
      capturedAt: ordered('captured_date').map(i => parseLooseDate(row[i])).find(Boolean) ?? null,
    };

    if (!person.name && !person.company && !person.email && !person.phone) { skippedEmpty++; continue; }
    people.push(person);
  }
  return { people, skippedEmpty };
}
