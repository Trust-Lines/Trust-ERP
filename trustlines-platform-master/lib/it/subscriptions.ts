// IT → Subscriptions (it_subscriptions, migration 159; users 160; billing and teams 162). Service-role
// reads/writes only after the IT checks (itContext / itApi). The login password is encrypted
// (APP_ENCRYPTION_KEY) and never part of a list — revealed one at a time through
// /api/it/subscriptions/[id]/secret (audited).
import { encryptToken } from '@/lib/crypto/secrets';
import type { ItContext } from './server';
import { isUuid } from './validate';

const BASE_COLS = 'id, service, login_email, logo_url, brand_color, seats, card_last4, start_date, due_date, notes, password_enc, cancelled_at, created_at';
/** With the 162 billing columns. */
export const SUB_COLS = `${BASE_COLS}, amount, currency, billing_cycle`;

export const CURRENCIES = ['USD', 'EUR', 'TRY', 'GBP'] as const;
export type Currency = typeof CURRENCIES[number];
export type BillingCycle = 'monthly' | 'yearly';

interface Row {
  id: string; service: string; login_email: string | null; logo_url: string | null; brand_color: string | null;
  seats: number | null; card_last4: string | null; start_date: string | null; due_date: string | null; notes: string | null;
  password_enc: string | null; cancelled_at: string | null; created_at: string;
  amount?: number | string | null; currency?: string | null; billing_cycle?: string | null;
}

export interface SubscriptionData {
  id: string; service: string; loginEmail: string; logoUrl: string | null; brandColor: string | null;
  /** "Maximum Users"; null = no limit. */
  seats: number | null;
  cardLast4: string | null; startDate: string | null; dueDate: string | null; notes: string | null;
  /** Cost of one billing period. */
  amount: number | null; currency: Currency | null; billingCycle: BillingCycle | null;
  active: boolean; hasPassword: boolean; createdAt: string;
  /** Who uses it (migration 160). Empty until someone is added. */
  users: SubscriptionUser[];
}

/**
 * A subscription's user: a person in the system, a typed name (no account / email yet), or a team
 * (a name with a head count, `teamSize`).
 */
export interface SubscriptionUser { personId: string | null; name: string; role?: string | null; teamSize?: number | null }

const toData = (r: Row): SubscriptionData => {
  const amount = r.amount == null || r.amount === '' ? null : Number(r.amount);
  return {
    id: r.id, service: r.service, loginEmail: r.login_email ?? '', logoUrl: r.logo_url, brandColor: r.brand_color,
    seats: r.seats, cardLast4: r.card_last4, startDate: r.start_date, dueDate: r.due_date, notes: r.notes,
    amount: amount != null && Number.isFinite(amount) ? amount : null,
    currency: (CURRENCIES as readonly string[]).includes(r.currency ?? '') ? r.currency as Currency : null,
    billingCycle: r.billing_cycle === 'monthly' || r.billing_cycle === 'yearly' ? r.billing_cycle : null,
    active: !r.cancelled_at, hasPassword: !!r.password_enc, createdAt: r.created_at, users: [],
  };
};

export const isMissingColumn = (e: { message?: string } | null | undefined) => !!e && /column|schema cache/i.test(e.message ?? '');

/** Reads with the 162 columns, or without them while that migration hasn't run. */
async function selectSubs(build: (cols: string) => PromiseLike<{ data: unknown; error: { message?: string } | null }>) {
  const r = await build(SUB_COLS);
  if (!isMissingColumn(r.error)) return r;
  return build(BASE_COLS);
}

/** Seats taken: one per person or name, a team counts its head count. */
export const usedSeats = (users: Pick<SubscriptionUser, 'teamSize'>[]) =>
  users.reduce((n, u) => n + (u.teamSize && u.teamSize > 0 ? u.teamSize : 1), 0);

export async function loadSubscriptions(ctx: ItContext): Promise<{ subscriptions: SubscriptionData[]; error: string | null }> {
  const { data, error } = await selectSubs(cols => ctx.admin.from('it_subscriptions').select(cols).is('deleted_at', null)
    .order('created_at', { ascending: false }).limit(1000));
  if (error) {
    const missing = /relation|does not exist|schema cache/i.test(error.message ?? '');
    return { subscriptions: [], error: missing ? 'Subscriptions aren’t set up yet. Run migration 159_it_assignments_subscriptions.sql in Supabase.' : 'Subscriptions could not be loaded.' };
  }
  const subscriptions = ((data ?? []) as Row[]).map(toData);
  const users = await loadSubscriptionUsers(ctx, subscriptions.map(s => s.id));
  for (const s of subscriptions) s.users = users.get(s.id) ?? [];
  return { subscriptions, error: null };
}

const USERS_MISSING = 'Run migration 160_it_subscription_users.sql in Supabase first.';
const TEAMS_MISSING = 'Run migration 162_it_subscription_billing.sql in Supabase first.';
const isMissing = (e: { message?: string } | null) => /relation|does not exist|schema cache/i.test(e?.message ?? '');

/** subscription id → its users, names and roles resolved. One query for the rows, one for the people. Fails soft. */
async function loadSubscriptionUsers(ctx: ItContext, ids: string[]): Promise<Map<string, SubscriptionUser[]>> {
  const out = new Map<string, SubscriptionUser[]>();
  if (!ids.length) return out;
  const q = (cols: string) => ctx.admin.from('it_subscription_users')
    .select(cols).in('subscription_id', ids).order('created_at').limit(5000);
  let r = await q('subscription_id, person_id, name, team_size, created_at');
  if (isMissingColumn(r.error)) r = await q('subscription_id, person_id, name, created_at');
  if (r.error) return out;
  const rows = (r.data ?? []) as { subscription_id: string; person_id: string | null; name: string | null; team_size?: number | null }[];
  const people = await personInfo(ctx, [...new Set(rows.map(x => x.person_id).filter((v): v is string => !!v))]);
  for (const x of rows) {
    const list = out.get(x.subscription_id) ?? [];
    const p = x.person_id ? people.get(x.person_id) : undefined;
    list.push({ personId: x.person_id, name: p?.name || x.name || 'Unknown', role: p?.role ?? null, teamSize: x.team_size ?? null });
    out.set(x.subscription_id, list);
  }
  return out;
}

async function personInfo(ctx: ItContext, ids: string[]): Promise<Map<string, { name: string; role: string | null }>> {
  if (!ids.length) return new Map();
  const { data } = await ctx.admin.from('profiles').select('id, full_name, email, role').in('id', ids);
  return new Map(((data ?? []) as { id: string; full_name: string | null; email: string | null; role: string | null }[])
    .map(p => [p.id, { name: p.full_name || p.email || 'Unknown', role: p.role }]));
}

export const MAX_SUB_USERS = 200;

export interface CleanSubUser { personId: string | null; name: string | null; teamSize: number | null }

/**
 * Body `users` → a clean list: people by id (each once), typed names (each once, 1–120 chars) and
 * teams (a name with `teamSize` 1–100000).
 */
export function cleanSubscriptionUsers(raw: unknown): { value: CleanSubUser[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: 'Users must be a list' };
  if (raw.length > MAX_SUB_USERS) return { error: `A subscription can list up to ${MAX_SUB_USERS} users` };
  const people = new Set<string>(); const typed = new Set<string>();
  const value: CleanSubUser[] = [];
  for (const u of raw as Record<string, unknown>[]) {
    if (u && isUuid(u.personId)) {
      if (!people.has(u.personId)) { people.add(u.personId); value.push({ personId: u.personId, name: null, teamSize: null }); }
      continue;
    }
    const name = typeof u?.name === 'string' ? u.name.trim().replace(/\s+/g, ' ') : '';
    if (!name) return { error: 'Each user needs a person or a name' };
    if (name.length > 120) return { error: 'A user’s name is too long' };
    let teamSize: number | null = null;
    if (u.teamSize != null && u.teamSize !== '') {
      const n = Number(u.teamSize);
      if (!Number.isInteger(n) || n < 1 || n > 100000) return { error: `${name}: the team size must be a whole number from 1` };
      teamSize = n;
    }
    if (!typed.has(name.toLowerCase())) { typed.add(name.toLowerCase()); value.push({ personId: null, name, teamSize }); }
  }
  return { value };
}

/** Replace a subscription's users. People must exist. Returns an error message (with a status) or null. */
export async function saveSubscriptionUsers(
  ctx: ItContext, subscriptionId: string, users: CleanSubUser[],
): Promise<{ error: string; status: number } | null> {
  const ids = users.map(u => u.personId).filter((v): v is string => !!v);
  if (ids.length) {
    const { data } = await ctx.admin.from('profiles').select('id').in('id', ids);
    if ((data ?? []).length !== ids.length) return { error: 'One of the chosen people no longer exists', status: 400 };
  }
  const teams = users.some(u => u.teamSize != null);
  const del = await ctx.admin.from('it_subscription_users').delete().eq('subscription_id', subscriptionId);
  if (del.error) return isMissing(del.error) ? { error: USERS_MISSING, status: 503 } : { error: 'Could not save the users', status: 500 };
  if (users.length) {
    const ins = await ctx.admin.from('it_subscription_users').insert(users.map(u => ({
      subscription_id: subscriptionId, person_id: u.personId, name: u.name,
      // Only when there's a team, so people and names still save before migration 162.
      ...(teams ? { team_size: u.teamSize } : {}),
    })));
    if (ins.error) return isMissingColumn(ins.error) ? { error: TEAMS_MISSING, status: 503 } : { error: 'Could not save the users', status: 500 };
  }
  return null;
}

/** The live subscriptions one person is listed on (staff page). Fails soft. */
export async function loadPersonSubscriptions(ctx: ItContext, personId: string): Promise<SubscriptionData[]> {
  const { data, error } = await ctx.admin.from('it_subscription_users').select('subscription_id').eq('person_id', personId).limit(500);
  if (error || !data?.length) return [];
  const ids = [...new Set((data as { subscription_id: string }[]).map(r => r.subscription_id))];
  const subs = await selectSubs(cols => ctx.admin.from('it_subscriptions').select(cols).in('id', ids).is('deleted_at', null).order('service'));
  if (subs.error) return [];
  return ((subs.data ?? []) as Row[]).map(toData);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** The 162 columns: left out of a save while that migration hasn't run (when they're empty). */
export const BILLING_FIELDS = ['amount', 'currency', 'billing_cycle'] as const;
export const withoutBilling = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).filter(([k]) => !(BILLING_FIELDS as readonly string[]).includes(k)));
export const hasBilling = (row: Record<string, unknown>) => BILLING_FIELDS.some(k => row[k] != null);

/**
 * Body → row fields. `partial` (PATCH): only the keys present change. Password: a non-empty string
 * sets it (encrypted), '' clears it, absent keeps it.
 */
export function cleanSubscriptionInput(raw: unknown, partial: boolean): { value: Record<string, unknown> } | { error: string } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const has = (k: string) => !partial || k in b;
  const out: Record<string, unknown> = {};

  if (has('service')) {
    const s = text(b.service, 80);
    if (!s) return { error: 'Enter the service name' };
    out.service = s;
  }
  if (has('loginEmail')) {
    const e = text(b.loginEmail, 254);
    if (e && !EMAIL.test(e)) return { error: 'The login email isn’t valid' };
    out.login_email = e;
  }
  if (has('logoUrl')) {
    const u = text(b.logoUrl, 500);
    if (u && !/^https:\/\/[^\s]+$/i.test(u)) return { error: 'The logo must be an https:// link' };
    out.logo_url = u;
  }
  if ('brandColor' in b) {
    const c = text(b.brandColor, 7);
    if (c && !/^#[0-9a-f]{6}$/i.test(c)) return { error: 'Brand colour must look like #DA1F26' };
    out.brand_color = c;
  }
  if (has('seats')) {
    const raw2 = b.seats;
    if (raw2 === '' || raw2 === null || raw2 === undefined) out.seats = null;
    else {
      const n = Number(raw2);
      if (!Number.isInteger(n) || n < 0 || n > 100000) return { error: 'Maximum users must be a whole number' };
      out.seats = n;
    }
  }
  if (has('amount')) {
    const v = typeof b.amount === 'number' ? String(b.amount) : typeof b.amount === 'string' ? b.amount.trim().replace(',', '.') : '';
    if (!v) out.amount = null;
    else {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return { error: 'The billing amount isn’t valid' };
      out.amount = Math.round(n * 100) / 100;
    }
  }
  if (has('currency')) {
    const c = text(b.currency, 3);
    if (c && !(CURRENCIES as readonly string[]).includes(c)) return { error: 'Pick a currency from the list' };
    out.currency = c;
  }
  if (has('billingCycle')) {
    const c = text(b.billingCycle, 10);
    if (c && c !== 'monthly' && c !== 'yearly') return { error: 'Billing must be monthly or yearly' };
    out.billing_cycle = c;
  }
  if (has('cardLast4')) {
    const c = text(b.cardLast4, 4);
    if (c && !/^\d{4}$/.test(c)) return { error: 'Card: the last 4 digits only' };
    out.card_last4 = c;
  }
  for (const [k, col] of [['startDate', 'start_date'], ['dueDate', 'due_date']] as const) {
    if (has(k)) out[col] = typeof b[k] === 'string' && DATE.test(b[k] as string) ? b[k] : null;
  }
  if (has('notes')) out.notes = text(b.notes, 4000);
  if (partial && 'active' in b) out.cancelled_at = b.active === false ? new Date().toISOString() : null;

  if ('password' in b) {
    const v = typeof b.password === 'string' ? b.password : '';
    if (v.length > 500) return { error: 'The password is too long' };
    try { out.password_enc = v ? encryptToken(v) : null; } catch {
      return { error: 'Passwords can’t be saved: APP_ENCRYPTION_KEY isn’t set on the server' };
    }
  }
  return { value: out };
}

/** The audit form of a change: never the password. */
export const subscriptionAudit = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === 'password_enc' ? (v ? 'set' : 'cleared') : v]));
