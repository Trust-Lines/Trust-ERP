// IT → Phone Numbers (it_phone_lines, migrations 158 + 161): input checks and the reads the list and
// detail pages share. Secrets (password, PIN, account number) are stored encrypted and are never
// part of a list or detail read — only lib/it/phones' revealSecret route decrypts one.

import { encryptToken } from '@/lib/crypto/secrets';
import type { ItContext } from './server';
import { isUuid } from './validate';

/* eslint-disable @typescript-eslint/no-explicit-any */

const BASE_COLS = 'id, number, carrier, firm, holder_id, holder_since, device_name, personal_device, device_assigned_at, email, imei, location, start_date, notes, retired_at, created_at, password_enc, pin_enc, account_number_enc';
/** 161: the sheet's extra fields. */
export const PHONE_COLS = `${BASE_COLS}, holder_name, account_holder, monthly_cost, device_condition`;
export type PhoneSecretKind = 'password' | 'pin' | 'accountNumber';
export const SECRET_COLUMN: Record<PhoneSecretKind, string> = { password: 'password_enc', pin: 'pin_enc', accountNumber: 'account_number_enc' };
export type DeviceCondition = 'new' | 'used';

interface Row {
  id: string; number: string; carrier: string | null; firm: string | null; holder_id: string | null; holder_since: string | null;
  device_name: string | null; personal_device: boolean; device_assigned_at: string | null; email: string | null; imei: string | null;
  location: string | null; start_date: string | null; notes: string | null; retired_at: string | null; created_at: string;
  password_enc: string | null; pin_enc: string | null; account_number_enc: string | null;
  holder_name?: string | null; account_holder?: string | null; monthly_cost?: number | string | null; device_condition?: string | null;
}

/** A line for the editor and the pages — secrets reduced to "is one stored". */
export interface PhoneLineData {
  id: string; number: string; carrier: string | null; firm: string | null;
  holderId: string | null;
  /** The staff member's name, or the typed name of someone with no account (holderId null). */
  holderName: string | null;
  holderRole: string | null; holderSince: string | null;
  deviceName: string | null; personalDevice: boolean; deviceAssignedAt: string | null;
  deviceCondition: DeviceCondition | null;
  email: string | null; imei: string | null; location: string | null; startDate: string | null; notes: string | null;
  accountHolder: string | null;
  /** USD per month. */
  monthlyCost: number | null;
  active: boolean; createdAt: string;
  hasSecret: Record<PhoneSecretKind, boolean>;
}

/** Selects with the 161 columns, or without them while the migration hasn't run. */
const missingColumn = (e: { message?: string } | null) => !!e && /column|schema cache/i.test(e.message ?? '');
async function selectLines(build: (cols: string) => PromiseLike<{ data: unknown; error: { message?: string } | null }>) {
  const r = await build(PHONE_COLS);
  return missingColumn(r.error) ? build(BASE_COLS) : r;
}

async function holders(admin: any, ids: (string | null)[]) {
  const want = [...new Set(ids.filter((v): v is string => !!v))];
  if (!want.length) return new Map<string, { full_name: string | null; email: string | null; role: string | null }>();
  const { data } = await admin.from('profiles').select('id, full_name, email, role').in('id', want);
  return new Map(((data ?? []) as { id: string; full_name: string | null; email: string | null; role: string | null }[]).map(p => [p.id, p]));
}

function toData(r: Row, who: Awaited<ReturnType<typeof holders>>): PhoneLineData {
  const h = r.holder_id ? who.get(r.holder_id) : undefined;
  const cost = r.monthly_cost == null ? null : Number(r.monthly_cost);
  return {
    id: r.id, number: r.number, carrier: r.carrier, firm: r.firm,
    holderId: r.holder_id,
    holderName: h ? h.full_name || h.email || 'Unknown' : r.holder_id ? 'Unknown' : r.holder_name ?? null,
    holderRole: h?.role ?? null, holderSince: r.holder_since,
    deviceName: r.device_name, personalDevice: r.personal_device, deviceAssignedAt: r.device_assigned_at,
    deviceCondition: r.device_condition === 'new' || r.device_condition === 'used' ? r.device_condition : null,
    email: r.email, imei: r.imei, location: r.location, startDate: r.start_date, notes: r.notes,
    accountHolder: r.account_holder ?? null, monthlyCost: cost != null && Number.isFinite(cost) ? cost : null,
    active: !r.retired_at, createdAt: r.created_at,
    hasSecret: { password: !!r.password_enc, pin: !!r.pin_enc, accountNumber: !!r.account_number_enc },
  };
}

export async function loadPhoneLines(ctx: ItContext): Promise<{ lines: PhoneLineData[]; error: string | null }> {
  const { data, error } = await selectLines(cols => ctx.admin.from('it_phone_lines').select(cols).is('deleted_at', null).order('created_at', { ascending: false }).limit(2000));
  if (error) {
    const missing = /relation|does not exist|schema cache/i.test(error.message ?? '');
    return { lines: [], error: missing ? 'Phone numbers aren’t set up yet — run migration 158_it_phone_lines.sql in Supabase.' : 'Phone numbers could not be loaded.' };
  }
  const rows = (data ?? []) as Row[];
  const who = await holders(ctx.admin, rows.map(r => r.holder_id));
  return { lines: rows.map(r => toData(r, who)), error: null };
}

export async function loadPhoneLine(ctx: ItContext, id: string): Promise<PhoneLineData | null> {
  const { data } = await selectLines(cols => ctx.admin.from('it_phone_lines').select(cols).eq('id', id).is('deleted_at', null).maybeSingle());
  if (!data) return null;
  const r = data as Row;
  return toData(r, await holders(ctx.admin, [r.holder_id]));
}

/** A carrier account the form can copy onto a new line ("Same account as"). */
export interface PhoneAccount {
  /** A line on that account; its saved account number is copied server-side. */
  lineId: string;
  carrier: string | null; firm: string | null; accountHolder: string | null; location: string | null;
  hasAccountNumber: boolean;
}

/** The distinct accounts on live lines, newest first: carrier + firm + account holder. */
export function phoneAccounts(lines: PhoneLineData[]): PhoneAccount[] {
  const seen = new Map<string, PhoneAccount>();
  for (const l of lines) {
    if (!l.carrier && !l.firm && !l.accountHolder) continue;
    const key = [l.carrier, l.firm, l.accountHolder].map(v => (v ?? '').trim().toLowerCase()).join('|');
    const prev = seen.get(key);
    // Prefer a line that has the account number saved.
    if (!prev || (!prev.hasAccountNumber && l.hasSecret.accountNumber)) {
      seen.set(key, { lineId: l.id, carrier: l.carrier, firm: l.firm, accountHolder: l.accountHolder, location: l.location, hasAccountNumber: l.hasSecret.accountNumber });
    }
  }
  return [...seen.values()];
}

// ── Input ──
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, max) : null);

/**
 * Body → row fields. Secrets: a non-empty string sets it (encrypted), '' clears it, absent keeps it.
 * `partial` (PATCH): only the keys present are changed. The holder is a staff member (holderId) or
 * a typed name (holderName) — never both.
 */
export function cleanPhoneInput(raw: unknown, partial: boolean): { value: Record<string, unknown> } | { error: string } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const has = (k: string) => !partial || k in b;
  const out: Record<string, unknown> = {};

  if (has('number')) {
    const n = text(b.number, 40);
    if (!n || n.replace(/\D/g, '').length < 3) return { error: 'Enter the phone number' };
    out.number = n;
  }
  for (const [k, col, max] of [['carrier', 'carrier', 80], ['firm', 'firm', 80], ['deviceName', 'device_name', 80], ['imei', 'imei', 40], ['location', 'location', 120], ['accountHolder', 'account_holder', 120]] as const) {
    if (has(k)) out[col] = text(b[k], max);
  }
  if (has('notes')) out.notes = typeof b.notes === 'string' && b.notes.trim() ? b.notes.trim().slice(0, 4000) : null;
  if (has('email')) {
    const e = text(b.email, 254);
    if (e && !EMAIL.test(e)) return { error: 'The mail address isn’t valid' };
    out.email = e;
  }
  // holder_since / device_assigned_at / start_date are stamped by the routes (stampPhoneDates).
  if (has('holderId') || has('holderName')) {
    out.holder_id = isUuid(b.holderId) ? b.holderId : null;
    out.holder_name = out.holder_id ? null : text(b.holderName, 120);
  }
  if (has('personalDevice')) out.personal_device = b.personalDevice === true;
  if (has('deviceCondition')) {
    const c = b.deviceCondition;
    if (c !== undefined && c !== null && c !== '' && c !== 'new' && c !== 'used') return { error: 'Condition must be New or Used' };
    out.device_condition = c === 'new' || c === 'used' ? c : null;
  }
  if (has('monthlyCost')) {
    const c = b.monthlyCost;
    if (c === '' || c === null || c === undefined) out.monthly_cost = null;
    else {
      const n = Number(typeof c === 'string' ? c.replace(',', '.') : c);
      if (!Number.isFinite(n) || n < 0 || n > 100000) return { error: 'The plan price must be a number, e.g. 58.10' };
      out.monthly_cost = Math.round(n * 100) / 100;
    }
  }
  if (partial && 'active' in b) out.retired_at = b.active === false ? new Date().toISOString() : null;

  for (const [k, col] of Object.entries(SECRET_COLUMN) as [PhoneSecretKind, string][]) {
    if (!(k in b)) continue;
    const v = typeof b[k] === 'string' ? (b[k] as string).trim() : '';
    if (v.length > 200) return { error: 'That value is too long' };
    try { out[col] = v ? encryptToken(v) : null; } catch {
      return { error: 'Passwords can’t be saved: APP_ENCRYPTION_KEY isn’t set on the server' };
    }
  }
  return { value: out };
}

/**
 * "Same account as" another line: when no account number was typed, copy that line's encrypted one
 * (server-side; the value never reaches the browser). Returns an error for an unknown line.
 */
export async function copyAccountNumber(ctx: ItContext, raw: unknown, value: Record<string, unknown>): Promise<string | null> {
  const from = (raw as Record<string, unknown> | null)?.copyAccountFrom;
  if (from === undefined || from === null || from === '' || 'account_number_enc' in value) return null;
  if (!isUuid(from)) return 'Choose the account again';
  const { data } = await ctx.admin.from('it_phone_lines').select('account_number_enc').eq('id', from).is('deleted_at', null).maybeSingle();
  if (!data) return 'That account’s line no longer exists';
  const enc = (data as { account_number_enc: string | null }).account_number_enc;
  if (enc) value.account_number_enc = enc;
  return null;
}

/** The 161 fields in a change — dropped when the migration hasn't run so older fields still save. */
export const SHEET_FIELDS = ['holder_name', 'account_holder', 'monthly_cost', 'device_condition'] as const;
export const withoutSheetFields = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).filter(([k]) => !(SHEET_FIELDS as readonly string[]).includes(k)));
export const isMissingColumn = missingColumn;

/** Today as YYYY-MM-DD (UTC). */
export const today = (now = new Date()) => now.toISOString().slice(0, 10);

type Holder = { holder_id?: string | null; holder_name?: string | null };
const holderKey = (h: Holder | null) => (h?.holder_id ? `id:${h.holder_id}` : h?.holder_name ? `name:${h.holder_name.toLowerCase()}` : null);

/**
 * Dates the server stamps: a new holder or company phone starts today; nobody / no phone clears it.
 * `before` is the saved line (null when adding).
 */
export function stampPhoneDates(
  value: Record<string, unknown>,
  before: { holder_id: string | null; holder_name?: string | null; device_name: string | null } | null,
  now = new Date(),
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!before) out.start_date = today(now);
  if ('holder_id' in value || 'holder_name' in value) {
    const next = holderKey(value as Holder);
    if (next !== holderKey(before)) out.holder_since = next ? today(now) : null;
  }
  if ('device_name' in value && (value.device_name ?? null) !== (before?.device_name ?? null)) out.device_assigned_at = value.device_name ? today(now) : null;
  return out;
}

/** The audit form of a change: field names only for secrets. */
export function auditFields(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k.endsWith('_enc') ? (v ? 'set' : 'cleared') : v]));
}

/** IT → Staff member: the active lines one person holds. */
export async function loadPhoneLinesFor(ctx: ItContext, holderId: string): Promise<PhoneLineData[]> {
  const { data } = await selectLines(cols => ctx.admin.from('it_phone_lines').select(cols).eq('holder_id', holderId)
    .is('deleted_at', null).is('retired_at', null).order('created_at', { ascending: false }).limit(50));
  const rows = (data ?? []) as Row[];
  if (!rows.length) return [];
  const who = await holders(ctx.admin, [holderId]);
  return rows.map(r => toData(r, who));
}
