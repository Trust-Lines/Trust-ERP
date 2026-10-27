// Marketing & PR workspace (migration 127): social media accounts, follower history, posts and
// the team calendar. Validation lives here so the API routes and the tests share one rule set.

export const SOCIAL_PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'other', label: 'Other' },
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]['value'];

export const SOCIAL_POST_STATUSES = ['idea', 'draft', 'scheduled', 'published', 'cancelled'] as const;
export type SocialPostStatus = (typeof SOCIAL_POST_STATUSES)[number];

export const CALENDAR_KINDS = [
  { value: 'event', label: 'Event / trade show' },
  { value: 'press', label: 'Press / media' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'content', label: 'Content' },
  { value: 'other', label: 'Other' },
] as const;
export type CalendarKind = (typeof CALENDAR_KINDS)[number]['value'];

export const POST_METRICS = ['impressions', 'reach', 'likes', 'comments', 'shares', 'saves', 'clicks'] as const;
export type PostMetric = (typeof POST_METRICS)[number];

export const SOCIAL_ACCOUNT_COLS = 'id, platform, handle, profile_url, notes, is_active, created_by, created_at, updated_at';
export const SOCIAL_POST_COLS = `id, account_id, title, caption, status, planned_on, published_on, post_url, campaign_id, ${POST_METRICS.join(', ')}, notes, created_by, created_at, updated_at`;
export const CALENDAR_COLS = 'id, title, kind, starts_on, ends_on, start_time, end_time, location, notes, campaign_id, created_by, created_at, updated_at';

export const platformLabel = (p: string) => SOCIAL_PLATFORMS.find(x => x.value === p)?.label ?? p;
export const calendarKindLabel = (k: string) => CALENDAR_KINDS.find(x => x.value === k)?.label ?? k;

type Raw = Record<string, unknown>;
type Result<T> = { value: T } | { error: string };

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const orNull = (v: unknown) => str(v) || null;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
    && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
}
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function optionalDate(v: unknown, label: string): Result<string | null> {
  if (v === null || v === undefined || v === '') return { value: null };
  return isIsoDate(v) ? { value: v } : { error: `${label} must be a valid date` };
}

function optionalUrl(v: unknown, label: string): Result<string | null> {
  const s = str(v);
  if (!s) return { value: null };
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
    return { value: s };
  } catch {
    return { error: `${label} must be a web link (https://…)` };
  }
}

function optionalCount(v: unknown, label: string): Result<number | null> {
  if (v === null || v === undefined || v === '') return { value: null };
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 2_000_000_000) return { error: `${label} must be a whole number of 0 or more` };
  return { value: n };
}

/** Keys present in `raw` only — a PATCH changes what it was sent and nothing else. */
function pick<T extends string>(raw: Raw, keys: readonly T[], partial: boolean): T[] {
  return partial ? keys.filter(k => k in raw) : [...keys];
}

// ── Accounts ─────────────────────────────────────────────────────────────────────────────

export interface SocialAccountInput {
  platform: SocialPlatform;
  handle: string;
  profile_url: string | null;
  notes: string | null;
  is_active: boolean;
}

export function parseSocialAccount(raw: unknown, partial = false): Result<Partial<SocialAccountInput>> {
  const b = (raw ?? {}) as Raw;
  const out: Partial<SocialAccountInput> = {};
  for (const k of pick(b, ['platform', 'handle', 'profile_url', 'notes', 'is_active'] as const, partial)) {
    if (k === 'platform') {
      const p = str(b.platform);
      if (!SOCIAL_PLATFORMS.some(x => x.value === p)) return { error: 'Pick a platform' };
      out.platform = p as SocialPlatform;
    } else if (k === 'handle') {
      const h = str(b.handle);
      if (!h) return { error: 'Account name / handle is required' };
      if (h.length > 120) return { error: 'Account name is too long' };
      out.handle = h;
    } else if (k === 'profile_url') {
      const r = optionalUrl(b.profile_url, 'Profile link');
      if ('error' in r) return r;
      out.profile_url = r.value;
    } else if (k === 'notes') {
      out.notes = orNull(b.notes);
    } else if (k === 'is_active') {
      if (partial && typeof b.is_active !== 'boolean') return { error: 'is_active must be true or false' };
      out.is_active = b.is_active !== false;
    }
  }
  return { value: out };
}

export function parseFollowerStat(raw: unknown): Result<{ recorded_on: string; followers: number }> {
  const b = (raw ?? {}) as Raw;
  if (!isIsoDate(b.recorded_on)) return { error: 'Pick a valid date' };
  const f = optionalCount(b.followers, 'Followers');
  if ('error' in f) return f;
  if (f.value === null) return { error: 'Followers is required' };
  return { value: { recorded_on: b.recorded_on, followers: f.value } };
}

// ── Posts ────────────────────────────────────────────────────────────────────────────────

export interface SocialPostInput {
  account_id: string | null;
  title: string;
  caption: string | null;
  status: SocialPostStatus;
  planned_on: string | null;
  published_on: string | null;
  post_url: string | null;
  campaign_id: string | null;
  notes: string | null;
  impressions: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function optionalId(v: unknown, label: string): Result<string | null> {
  const s = str(v);
  if (!s) return { value: null };
  return UUID_RE.test(s) ? { value: s } : { error: `${label} is not valid` };
}

const POST_KEYS = ['account_id', 'title', 'caption', 'status', 'planned_on', 'published_on', 'post_url', 'campaign_id', 'notes', ...POST_METRICS] as const;

export function parseSocialPost(raw: unknown, partial = false): Result<Partial<SocialPostInput>> {
  const b = (raw ?? {}) as Raw;
  const out: Partial<SocialPostInput> = {};
  for (const k of pick(b, POST_KEYS, partial)) {
    if (k === 'title') {
      const t = str(b.title);
      if (!t) return { error: 'Title is required' };
      if (t.length > 200) return { error: 'Title is too long' };
      out.title = t;
    } else if (k === 'status') {
      const s = str(b.status) || 'idea';
      if (!SOCIAL_POST_STATUSES.includes(s as SocialPostStatus)) return { error: 'Pick a valid status' };
      out.status = s as SocialPostStatus;
    } else if (k === 'planned_on' || k === 'published_on') {
      const r = optionalDate(b[k], k === 'planned_on' ? 'Planned date' : 'Published date');
      if ('error' in r) return r;
      out[k] = r.value;
    } else if (k === 'post_url') {
      const r = optionalUrl(b.post_url, 'Post link');
      if ('error' in r) return r;
      out.post_url = r.value;
    } else if (k === 'account_id' || k === 'campaign_id') {
      const r = optionalId(b[k], k === 'account_id' ? 'Account' : 'Campaign');
      if ('error' in r) return r;
      out[k] = r.value;
    } else if (k === 'caption' || k === 'notes') {
      out[k] = orNull(b[k]);
    } else {
      const r = optionalCount(b[k], k[0].toUpperCase() + k.slice(1));
      if ('error' in r) return r;
      out[k] = r.value;
    }
  }
  // A published post always has a publish date: default it to the planned date (or leave the
  // route to fill in today) so it shows on the calendar and in "this month" counts.
  if (out.status === 'published' && !partial && !out.published_on) out.published_on = out.planned_on ?? null;
  return { value: out };
}

/** Likes + comments + shares + saves + clicks — the interactions that count as engagement. */
export function engagementOf(p: Partial<Record<PostMetric, number | null>>): number {
  return (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0) + (p.clicks ?? 0);
}

/** Engagement as a % of impressions (falls back to reach); null when neither is known. */
export function engagementRate(p: Partial<Record<PostMetric, number | null>>): number | null {
  const base = p.impressions || p.reach;
  if (!base) return null;
  return Math.round((engagementOf(p) / base) * 1000) / 10;
}

/** Follower growth between the two latest snapshots, as a % (one decimal). */
export function followerGrowth(stats: { recorded_on: string; followers: number }[]): { latest: number | null; changePct: number | null } {
  const sorted = [...stats].sort((a, b) => b.recorded_on.localeCompare(a.recorded_on));
  const [last, prev] = sorted;
  if (!last) return { latest: null, changePct: null };
  if (!prev || prev.followers === 0) return { latest: last.followers, changePct: null };
  return { latest: last.followers, changePct: Math.round(((last.followers - prev.followers) / prev.followers) * 1000) / 10 };
}

// ── Calendar ─────────────────────────────────────────────────────────────────────────────

export interface CalendarEntryInput {
  title: string;
  kind: CalendarKind;
  starts_on: string;
  ends_on: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  campaign_id: string | null;
}

const CAL_KEYS = ['title', 'kind', 'starts_on', 'ends_on', 'start_time', 'end_time', 'location', 'notes', 'campaign_id'] as const;

/**
 * Validates a calendar entry. On PATCH (`partial`), pass the stored row as `current` so the
 * date/time order is checked against the merged result, not just the fields that were sent.
 */
export function parseCalendarEntry(raw: unknown, partial = false, current?: Partial<CalendarEntryInput>): Result<Partial<CalendarEntryInput>> {
  const b = (raw ?? {}) as Raw;
  const out: Partial<CalendarEntryInput> = {};
  for (const k of pick(b, CAL_KEYS, partial)) {
    if (k === 'title') {
      const t = str(b.title);
      if (!t) return { error: 'Title is required' };
      if (t.length > 200) return { error: 'Title is too long' };
      out.title = t;
    } else if (k === 'kind') {
      const kind = str(b.kind) || 'other';
      if (!CALENDAR_KINDS.some(x => x.value === kind)) return { error: 'Pick a type' };
      out.kind = kind as CalendarKind;
    } else if (k === 'starts_on') {
      if (!isIsoDate(b.starts_on)) return { error: 'Pick a start date' };
      out.starts_on = b.starts_on;
    } else if (k === 'ends_on') {
      const r = optionalDate(b.ends_on, 'End date');
      if ('error' in r) return r;
      out.ends_on = r.value;
    } else if (k === 'start_time' || k === 'end_time') {
      const s = str(b[k]);
      if (s && !TIME_RE.test(s)) return { error: `${k === 'start_time' ? 'Start' : 'End'} time is not valid` };
      out[k] = s ? s.slice(0, 5) : null;
    } else if (k === 'campaign_id') {
      const r = optionalId(b.campaign_id, 'Campaign');
      if ('error' in r) return r;
      out.campaign_id = r.value;
    } else {
      out[k] = orNull(b[k]);
    }
  }

  const merged = { ...current, ...out };
  if (merged.ends_on && merged.starts_on && merged.ends_on < merged.starts_on) return { error: 'End date can’t be before the start date' };
  const sameDay = !merged.ends_on || merged.ends_on === merged.starts_on;
  if (sameDay && merged.start_time && merged.end_time && merged.end_time < merged.start_time) {
    return { error: 'End time can’t be before the start time' };
  }
  // A one-day entry is stored with no end date, so "multi-day" always means ends_on is set.
  if (out.ends_on && out.ends_on === merged.starts_on) out.ends_on = null;
  return { value: out };
}

/** Every YYYY-MM-DD from `from` to `to` inclusive (UTC, no time zone drift). */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end && out.length < 400) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** The 6-week grid (Monday first) that shows `month` (YYYY-MM): first and last visible day. */
export function monthGridRange(month: string): { from: string; to: string } {
  const first = new Date(`${month}-01T00:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - offset);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 41);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

export function isMonth(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}
