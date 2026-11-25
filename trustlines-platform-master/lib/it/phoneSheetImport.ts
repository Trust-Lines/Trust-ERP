// Reads the "Phones and sim cards info" workbook (as string grids, lib/client/readSpreadsheet) into
// rows for /api/it/import. Pure, unit-tested in tests/itPhoneSheetImport.test.ts.
//
// The sheet has sections, each a title row and a header row, then one row per line:
//   "T-Mobile T LINES LLC. TAISSIER ALRAHWANJI 977800574"   → carrier, firm, account holder, account no
//   "Verizon T LINES LLC. NAIM KABBANI 742683508-00001 …"   (anything after the account no is ignored)
//   "TLINES Google Numbers"                                  → Google numbers, firm T LINES LLC
//   "Trust Lines"                                            → Turkcell lines, firm TRUST LINES
// Header row: USER, PHONE, NUMBER, MAIL, PASSWORD / LOCATION, PIN, IMEI, Firm name, Account no, Location.
// IMEI cells hold more than the IMEI: "Used (T-Mobile 58.1) 357716584828487" = used phone, $58.10
// plan; "T-mobile (66.0) / personal phone"; a second 15-digit number is the free SIM slot's IMEI.
// A sheet with "User" and "Device Type" columns lists computers → Items Library (no holder; the
// user's name goes in the notes). Names are never matched to accounts.

export interface ImportLine {
  number: string;
  holderName?: string;
  deviceName?: string;
  personalDevice?: boolean;
  deviceCondition?: 'new' | 'used';
  imei?: string;
  email?: string;
  password?: string;
  pin?: string;
  carrier?: string;
  firm?: string;
  accountHolder?: string;
  accountNumber?: string;
  monthlyCost?: string;
  location?: string;
  notes?: string;
}

export interface ImportItem { name: string; model: string | null; category: 'laptop' | 'pc'; status: 'available'; notes: string }

interface Section { carrier: string | null; firm: string | null; accountHolder: string | null; accountNumber: string | null; kind: 'carrier' | 'google' | 'trustlines' }

const clean = (v: string | undefined) => (v ?? '').replace(/\s+/g, ' ').trim();
const norm = (v: string) => clean(v).toLowerCase();
const CARRIERS: [RegExp, string][] = [[/^t-?mobile\b/i, 'T-Mobile'], [/^verizon\b/i, 'Verizon'], [/^at&t\b/i, 'AT&T'], [/^turkcell\b/i, 'Turkcell'], [/^vodafone\b/i, 'Vodafone']];

/** A section title row → what every line under it shares; null when the row isn't a title. */
export function parseSectionTitle(text: string): Section | null {
  const t = clean(text);
  if (!t) return null;
  if (/google numbers?/i.test(t)) return { carrier: 'Google Number', firm: 'T LINES LLC', accountHolder: null, accountNumber: null, kind: 'google' };
  if (/^trust\s*-?\s*lines$/i.test(t)) return { carrier: 'Turkcell', firm: 'TRUST LINES', accountHolder: null, accountNumber: null, kind: 'trustlines' };
  const carrier = CARRIERS.find(([re]) => re.test(t));
  if (!carrier) return null;
  let rest = t.replace(carrier[0], '').trim();
  const acc = /(\d[\d-]{5,}\d)/.exec(rest);
  const accountNumber = acc ? acc[1] : null;
  if (acc) rest = rest.slice(0, acc.index).trim();
  // "T LINES LLC. TAISSIER ALRAHWANJI": the firm ends at "LLC." / "INC."; no such word = all firm.
  const split = /^(.*?\b(?:LLC|INC|LTD|CORP)\.?)\s+(.+)$/i.exec(rest);
  const firm = clean((split ? split[1] : rest).replace(/\.$/, ''));
  return { carrier: carrier[1], firm: firm || null, accountHolder: split ? clean(split[2]) : null, accountNumber, kind: 'carrier' };
}

/** "Turkey" → Istanbul (the app's offices); US places → USA. */
export function officeOf(v: string): { location?: string; note?: string } {
  const t = clean(v);
  if (!t) return {};
  if (/turkey|türkiye|istanbul/i.test(t)) return { location: 'Istanbul' };
  if (/syria/i.test(t)) return { location: 'Syria' };
  if (/\b(usa|us|united states)\b/i.test(t) || /, *[A-Z]{2}\b/.test(t)) return { location: 'USA', ...(norm(t) === 'usa' ? {} : { note: t }) };
  return { note: t };
}

/** The IMEI cell → IMEI, a second (free slot) IMEI, used / new, plan per month, carrier. */
export function parseImeiCell(v: string): { imei?: string; secondImei?: string; condition?: 'used' | 'new'; monthlyCost?: string; costText?: string; carrier?: string; personal: boolean } {
  const t = clean(v);
  const imeis = t.match(/\d{15}/g) ?? [];
  const cost = /\(\s*(?:[A-Za-z&-]+\s*)?(\d+(?:\.\d+){0,2})\s*\)/.exec(t);
  let monthlyCost: string | undefined;
  let costText: string | undefined;
  if (cost) {
    const parts = cost[1].split('.');
    // "65.0.2" in the sheet: read as 65.02.
    monthlyCost = parts.length === 3 ? `${parts[0]}.${parts[1]}${parts[2]}` : cost[1];
    monthlyCost = Number(monthlyCost).toFixed(2);
    if (parts.length === 3) costText = cost[0].replace(/[()]/g, '').trim();
  }
  const carrier = CARRIERS.find(([re]) => re.test(t.replace(/^used\s*\(\s*/i, '')))?.[1] ?? (/turkcell/i.test(t) ? 'Turkcell' : undefined);
  return {
    imei: imeis[0], secondImei: imeis[1],
    condition: /\bused\b/i.test(t) ? 'used' : /\bnew\b/i.test(t) ? 'new' : undefined,
    monthlyCost, costText, carrier, personal: /personal/i.test(t),
  };
}

const EMPTY_USER = /^(-+|empty\b.*|available)$/i;

function headerIndex(row: string[]): Record<string, number> | null {
  const h = row.map(norm);
  if (!h.includes('number') || !h.includes('user')) return null;
  const at = (name: string, from = 0) => h.indexOf(name, from);
  const loc = h.lastIndexOf('location');
  return {
    user: at('user'), phone: at('phone'), number: at('number'), mail: at('mail'), password: at('password'), pin: at('pin'),
    imei: at('imei'), firm: at('firm name'), account: at('account no'),
    // Google numbers put a LOCATION column where PASSWORD is, and keep the last "Location" too.
    place: h.indexOf('location'), location: loc,
  };
}

/** Every phone line and computer in the workbook, plus notes on what was guessed or skipped. */
export function parsePhoneWorkbook(sheets: { name: string; rows: string[][] }[]): { lines: ImportLine[]; items: ImportItem[]; warnings: string[] } {
  const lines: ImportLine[] = [];
  const items: ImportItem[] = [];
  const warnings: string[] = [];

  for (const sheet of sheets) {
    let section: Section | null = null;
    let cols: Record<string, number> | null = null;
    let deviceCols: { user: number; type: number } | null = null;

    for (const raw of sheet.rows) {
      const row = raw.map(c => c ?? '');
      const filled = row.map(clean).filter(Boolean);
      if (!filled.length) continue;

      // Computers sheet: "User | Device Type".
      const lower = row.map(norm);
      if (lower.includes('user') && lower.includes('device type')) { deviceCols = { user: lower.indexOf('user'), type: lower.indexOf('device type') }; cols = null; continue; }
      if (deviceCols && !cols) {
        const user = clean(row[deviceCols.user]); const type = clean(row[deviceCols.type]);
        if (user && type) {
          const name = type.replace(/^mac\b/i, 'Mac');
          items.push({ name, model: clean(type.replace(/^mac\s*/i, '')) || null, category: 'laptop', status: 'available', notes: `User: ${user}` });
        }
        continue;
      }

      if (filled.length <= 2) {
        const s = parseSectionTitle(filled.join(' '));
        if (s) { section = s; cols = null; continue; }
        if (/sim cards info/i.test(filled[0])) continue;
      }
      const hdr = headerIndex(row);
      if (hdr) { cols = hdr; continue; }
      if (!cols) continue;

      const get = (k: string) => (cols![k] >= 0 ? clean(row[cols![k]]) : '');
      const number = get('number');
      if (!number || number.replace(/\D/g, '').length < 7) continue;

      const notes: string[] = [];
      const line: ImportLine = { number };
      const user = get('user');
      if (user && !EMPTY_USER.test(user)) line.holderName = user;
      else if (user && !/^-+$/.test(user)) notes.push(user);

      const imeiCell = parseImeiCell(get('imei'));
      const phone = get('phone');
      if (/personal/i.test(phone) || (imeiCell.personal && !phone)) line.personalDevice = true;
      else if (/google/i.test(phone) || /^(-+|no phone)$/i.test(phone) || !phone) { /* no phone */ }
      else if (/has the sim/i.test(phone)) notes.push(phone);
      else line.deviceName = phone.replace(/\biphone\b/i, 'iPhone').replace(/\bsamsung\s*/i, 'Samsung ').replace(/\s+/g, ' ');

      if (imeiCell.imei) line.imei = imeiCell.imei;
      if (imeiCell.secondImei) notes.push(`Second SIM slot free, IMEI ${imeiCell.secondImei}`);
      if (imeiCell.condition && line.deviceName) line.deviceCondition = imeiCell.condition;
      if (imeiCell.monthlyCost) line.monthlyCost = imeiCell.monthlyCost;
      if (imeiCell.costText) notes.push(`Sheet: ${imeiCell.costText}`);

      const mail = get('mail');
      if (mail && /@/.test(mail)) line.email = mail.replace(/\s+/g, '');
      const password = get('password');
      if (password && !/^-+$/.test(password) && cols.password !== cols.place) line.password = password;
      const pin = get('pin');
      if (pin && !/^-+$/.test(pin)) line.pin = pin;

      line.carrier = section?.carrier ?? imeiCell.carrier;
      if (section?.kind === 'google' && !line.carrier) line.carrier = 'Google Number';
      line.firm = section?.firm ?? (get('firm').split(/\n/)[0] || undefined);
      if (section?.accountHolder) line.accountHolder = section.accountHolder;
      const account = section?.accountNumber ?? (get('account') || undefined);
      if (account) line.accountNumber = account;

      const office = officeOf(section?.kind === 'google' ? get('place') : get('location'));
      if (office.location) line.location = office.location;
      else if (section?.kind === 'trustlines') line.location = 'Istanbul';
      if (section?.kind === 'google') notes.unshift(['Google Number', office.note].filter(Boolean).join(' · '));
      else if (office.note) notes.push(office.note);

      if (notes.length) line.notes = notes.join(' · ');
      if (!section) warnings.push(`${number}: no section title above it — carrier and firm left empty`);
      lines.push(line);
    }
  }

  // The same number twice in the file: the first row is kept.
  const seen = new Set<string>();
  const unique: ImportLine[] = [];
  for (const l of lines) {
    const key = l.number.replace(/\D/g, '').slice(-10);
    if (seen.has(key)) { warnings.push(`${l.number} appears twice in the file — kept the first row`); continue; }
    seen.add(key);
    unique.push(l);
  }
  return { lines: unique, items, warnings };
}
