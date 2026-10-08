// Normalised "keys" used to decide whether two rows (or a row and an existing Contact) describe
// the same person / company. Pure functions — shared by the browser (in-file de-duplication) and
// the server (matching against the CRM) so both always agree.

const EMAIL_RE = /[A-Z0-9._%+'-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

/** First valid e-mail found in a cell (cells often hold "a@x.com; b@y.com"), lower-cased. */
export function emailKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = value.match(EMAIL_RE);
  return m ? m[0].toLowerCase() : null;
}

export function allEmails(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  const found = value.match(new RegExp(EMAIL_RE.source, 'gi')) ?? [];
  return [...new Set(found.map(e => e.toLowerCase()))];
}

/**
 * Comparable phone key: digits only, last 10 when long enough (drops +1 / 00 country prefixes and
 * punctuation so "(478) 365-4936", "+1 478-365-4936" and "4783654936" are equal). Anything shorter
 * than 7 digits is not a usable phone.
 */
export function phoneKey(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length < 7) return null;
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/** Every phone number in a cell ("847-751-0563 / 847-555-0000"), as display strings. */
export function allPhones(value: unknown): string[] {
  if (typeof value !== 'string' && typeof value !== 'number') return [];
  const parts = String(value).split(/[;|/\n]|\s{2,}|,(?=\s*[+(\d])/).map(p => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) if (phoneKey(p) && !out.some(o => phoneKey(o) === phoneKey(p))) out.push(p);
  return out;
}

function stripAccents(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

export function nameTokens(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return stripAccents(value).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

export function nameKey(value: unknown): string | null {
  const t = nameTokens(value);
  return t.length ? t.join(' ') : null;
}

export type NameMatch = 'same' | 'compatible' | 'partial' | null;

/**
 * How alike two PERSON names are.
 *  same        – identical after normalising ("Rocky K" / "rocky  k.")
 *  compatible  – same family name and a compatible first name ("Mike R" / "Michael Roettgers" no,
 *                "Alex C" / "Alex Cing" yes): safe to treat as the same person when another key
 *                (phone) also agrees
 *  partial     – only one side has a single word that equals the other's first name ("Alex" / "Alex Cing")
 */
export function compareNames(a: unknown, b: unknown): NameMatch {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return null;
  if (ta.join(' ') === tb.join(' ')) return 'same';

  if (ta.length >= 2 && tb.length >= 2) {
    const [fa, la] = [ta[0], ta[ta.length - 1]];
    const [fb, lb] = [tb[0], tb[tb.length - 1]];
    const lastOk = la === lb || (la.length === 1 && lb.startsWith(la)) || (lb.length === 1 && la.startsWith(lb));
    const firstOk = fa === fb || fa.startsWith(fb) || fb.startsWith(fa);
    if (lastOk && firstOk) return 'compatible';
    return null;
  }
  const single = ta.length === 1 ? ta[0] : tb[0];
  const other = ta.length === 1 ? tb : ta;
  if (other.length >= 2 && other[0] === single) return 'partial';
  return null;
}

const COMPANY_NOISE = new Set([
  'inc', 'incorporated', 'llc', 'l', 'c', 'ltd', 'limited', 'corp', 'corporation', 'co', 'company', 'companies',
  'the', 'and', 'dba', 'group', 'holdings', 'enterprises', 'enterprise',
]);

/** Company comparison key: lower-case, accents/punctuation/legal suffixes removed. */
export function companyKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const tokens = nameTokens(value.replace(/&/g, ' and ')).filter(t => !COMPANY_NOISE.has(t));
  const key = tokens.join('');
  return key.length >= 2 ? key : null;
}

/** 'same' when keys are equal; 'similar' when one contains the other (≥5 chars) — e.g. "Kent oil" / "Kent Oil Company". */
export function compareCompanies(a: unknown, b: unknown): 'same' | 'similar' | null {
  const ka = companyKey(a);
  const kb = companyKey(b);
  if (!ka || !kb) return null;
  if (ka === kb) return 'same';
  const [short, long] = ka.length <= kb.length ? [ka, kb] : [kb, ka];
  return short.length >= 5 && long.includes(short) ? 'similar' : null;
}

/**
 * Reads the many ways a spreadsheet writes a date — "10/7/26 5:14 PM" (US month/day/year),
 * "2026-10-07", "Oct 7, 2026", an Excel serial number — into an ISO string, or null when it is not
 * clearly a date. A time that is cut off ("10/7/26 1:") is ignored rather than guessed.
 */
export function parseLooseDate(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const valid = (d: Date) => (!Number.isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100 ? d.toISOString() : null);

  if (/^\d{5}(\.\d+)?$/.test(raw)) { // Excel serial day number
    const n = Number(raw);
    return n > 20000 && n < 80000 ? valid(new Date(Math.round((n - 25569) * 86400 * 1000))) : null;
  }
  const time = (m: RegExpMatchArray | null): [number, number] => {
    if (!m) return [0, 0];
    let h = Number(m[1]);
    const min = Number(m[2]);
    const ap = (m[3] ?? '').toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return h < 24 && min < 60 ? [h, min] : [0, 0];
  };
  const clock = raw.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]m)?/i);

  const us = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/);
  if (us) {
    const [mo, da] = [Number(us[1]), Number(us[2])];
    const yr = us[3].length === 2 ? 2000 + Number(us[3]) : Number(us[3]);
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
    const [h, min] = time(clock);
    return valid(new Date(yr, mo - 1, da, h, min));
  }
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const [h, min] = time(clock);
    return valid(new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), h, min));
  }
  return /[a-z]{3}/i.test(raw) ? valid(new Date(raw)) : null;
}
