// IT → Phone Numbers (it_phone_lines, migration 158): input checks and the reads the list and
// detail pages share. Secrets (password, PIN, account number) are stored encrypted and are never
// part of a list or detail read — only lib/it/phones' revealSecret route decrypts one.

import { encryptToken } from '@/lib/crypto/secrets';
import type { ItContext } from './server';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const PHONE_COLS = 'id, number, carrier, firm, holder_id, holder_since, device_name, personal_device, device_assigned_at, email, imei, location, start_date, notes, retired_at, created_at, password_enc, pin_enc, account_number_enc';
export type PhoneSecretKind = 'password' | 'pin' | 'accountNumber';
export const SECRET_COLUMN: Record<PhoneSecretKind, string> = { password: 'password_enc', pin: 'pin_enc', accountNumber: 'account_number_enc' };

interface Row {
  id: string; number: string; carrier: string | null; firm: string | null; holder_id: string | null; holder_since: string | null;
  device_name: string | null; personal_device: boolean; device_assigned_at: string | null; email: string | null; imei: string | null;
  location: string | null; start_date: string | null; notes: string | null; retired_at: string | null; created_at: string;
  password_enc: string | null; pin_enc: string | null; account_number_enc: string | null;
}

/** A line for the editor and the pages — secrets reduced to "is one stored". */
export interface PhoneLineData {
  id: string; number: string; carrier: string | null; firm: string | null;
  holderId: string | null; holderName: string | null; holderRole: string | null; holderSince: string | null;
  deviceName: string | null; personalDevice: boolean; deviceAssignedAt: string | null;
  email: string | null; imei: string | null; location: string | null; startDate: string | null; notes: string | null;
  active: boolean; createdAt: string;
  hasSecret: Record<PhoneSecretKind, boolean>;
}

async function holders(admin: any, ids: (string | null)[]) {
  const want = [...new Set(ids.filter((v): v is string => !!v))];
  if (!want.length) return new Map<string, { full_name: string | null; email: string | null; role: string | null }>();
  const { data } = await admin.from('profiles').select('id, full_name, email, role').in('id', want);
  return new Map(((data ?? []) as { id: string; full_name: string | null; email: string | null; role: string | null }[]).map(p => [p.id, p]));
}

function toData(r: Row, who: Awaited<ReturnType<typeof holders>>): PhoneLineData {
  const h = r.holder_id ? who.get(r.holder_id) : undefined;
  return {
    id: r.id, number: r.number, carrier: r.carrier, firm: r.firm,
    holderId: r.holder_id, holderName: h ? h.full_name || h.email || 'Unknown' : null, holderRole: h?.role ?? null, holderSince: r.holder_since,
    deviceName: r.device_name, personalDevice: r.personal_device, deviceAssignedAt: r.device_assigned_at,
    email: r.email, imei: r.imei, location: r.location, startDate: r.start_date, notes: r.notes,
    active: !r.retired_at, createdAt: r.created_at,
    hasSecret: { password: !!r.password_enc, pin: !!r.pin_enc, accountNumber: !!r.account_number_enc },
  };
}

export async function loadPhoneLines(ctx: ItContext): Promise<{ lines: PhoneLineData[]; error: string | null }> {
  const { data, error } = await ctx.admin.from('it_phone_lines').select(PHONE_COLS).is('deleted_at', null).order('created_at', { ascending: false }).limit(2000);
  if (error) {
    const missing = /relation|does not exist|schema cache/i.test(error.message ?? '');
    return { lines: [], error: missing ? 'Phone numbers aren’t set up yet — run migration 158_it_phone_lines.sql in Supabase.' : 'Phone numbers could not be loaded.' };
  }
  const rows = (data ?? []) as Row[];
  const who = await holders(ctx.admin, rows.map(r => r.holder_id));
  return { lines: rows.map(r => toData(r, who)), error: null };
}

export async function loadPhoneLine(ctx: ItContext, id: string): Promise<PhoneLineData | null> {
  const { data } = await ctx.admin.from('it_phone_lines').select(PHONE_COLS).eq('id', id).is('deleted_at', null).maybeSingle();
  if (!data) return null;
  const r = data as Row;
  return toData(r, await holders(ctx.admin, [r.holder_id]));
}

// ── Input ──
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const date = (v: unknown) => (typeof v === 'string' && DATE.test(v) ? v : null);

/**
 * Body → row fields. Secrets: a non-empty string sets it (encrypted), '' clears it, absent keeps it.
 * `partial` (PATCH): only the keys present are changed.
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
  for (const [k, col, max] of [['carrier', 'carrier', 80], ['firm', 'firm', 80], ['deviceName', 'device_name', 80], ['imei', 'imei', 40], ['location', 'location', 120], ['notes', 'notes', 4000]] as const) {
    if (has(k)) out[col] = text(b[k], max);
  }
  if (has('email')) {
    const e = text(b.email, 254);
    if (e && !EMAIL.test(e)) return { error: 'The mail address isn’t valid' };
    out.email = e;
  }
  for (const [k, col] of [['holderSince', 'holder_since'], ['startDate', 'start_date'], ['deviceAssignedAt', 'device_assigned_at']] as const) {
    if (has(k)) out[col] = date(b[k]);
  }
  if (has('holderId')) out.holder_id = typeof b.holderId === 'string' && /^[0-9a-f-]{36}$/i.test(b.holderId) ? b.holderId : null;
  if (has('personalDevice')) out.personal_device = b.personalDevice === true;
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

/** The audit form of a change: field names only for secrets. */
export function auditFields(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k.endsWith('_enc') ? (v ? 'set' : 'cleared') : v]));
}

/** IT → Staff member: the active lines one person holds. */
export async function loadPhoneLinesFor(ctx: ItContext, holderId: string): Promise<PhoneLineData[]> {
  const { data } = await ctx.admin.from('it_phone_lines').select(PHONE_COLS).eq('holder_id', holderId)
    .is('deleted_at', null).is('retired_at', null).order('created_at', { ascending: false }).limit(50);
  const rows = (data ?? []) as Row[];
  if (!rows.length) return [];
  const who = await holders(ctx.admin, [holderId]);
  return rows.map(r => toData(r, who));
}
