// IT → Subscriptions (it_subscriptions, migration 159). Service-role reads/writes only after the IT
// checks (itContext / itApi). The login password is encrypted (APP_ENCRYPTION_KEY) and never part
// of a list — revealed one at a time through /api/it/subscriptions/[id]/secret (audited).
import { encryptToken } from '@/lib/crypto/secrets';
import type { ItContext } from './server';

export const SUB_COLS = 'id, service, login_email, logo_url, brand_color, seats, card_last4, start_date, due_date, notes, password_enc, cancelled_at, created_at';

interface Row {
  id: string; service: string; login_email: string | null; logo_url: string | null; brand_color: string | null;
  seats: number | null; card_last4: string | null; start_date: string | null; due_date: string | null; notes: string | null;
  password_enc: string | null; cancelled_at: string | null; created_at: string;
}

export interface SubscriptionData {
  id: string; service: string; loginEmail: string; logoUrl: string | null; brandColor: string | null;
  seats: number | null; cardLast4: string | null; startDate: string | null; dueDate: string | null; notes: string | null;
  active: boolean; hasPassword: boolean; createdAt: string;
}

const toData = (r: Row): SubscriptionData => ({
  id: r.id, service: r.service, loginEmail: r.login_email ?? '', logoUrl: r.logo_url, brandColor: r.brand_color,
  seats: r.seats, cardLast4: r.card_last4, startDate: r.start_date, dueDate: r.due_date, notes: r.notes,
  active: !r.cancelled_at, hasPassword: !!r.password_enc, createdAt: r.created_at,
});

export async function loadSubscriptions(ctx: ItContext): Promise<{ subscriptions: SubscriptionData[]; error: string | null }> {
  const { data, error } = await ctx.admin.from('it_subscriptions').select(SUB_COLS).is('deleted_at', null)
    .order('created_at', { ascending: false }).limit(1000);
  if (error) {
    const missing = /relation|does not exist|schema cache/i.test(error.message ?? '');
    return { subscriptions: [], error: missing ? 'Subscriptions aren’t set up yet. Run migration 159_it_assignments_subscriptions.sql in Supabase.' : 'Subscriptions could not be loaded.' };
  }
  return { subscriptions: ((data ?? []) as Row[]).map(toData), error: null };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

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
  if (has('brandColor')) {
    const c = text(b.brandColor, 7);
    if (c && !/^#[0-9a-f]{6}$/i.test(c)) return { error: 'Brand colour must look like #DA1F26' };
    out.brand_color = c;
  }
  if (has('seats')) {
    const raw2 = b.seats;
    if (raw2 === '' || raw2 === null || raw2 === undefined) out.seats = null;
    else {
      const n = Number(raw2);
      if (!Number.isInteger(n) || n < 0 || n > 100000) return { error: 'Users must be a whole number' };
      out.seats = n;
    }
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
