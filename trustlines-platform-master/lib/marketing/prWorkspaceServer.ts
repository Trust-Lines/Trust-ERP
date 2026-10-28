import { NextResponse } from 'next/server';
import { MARKETING_MANAGE_ROLES } from '@/lib/marketing/roles';
import { CALENDAR_COLS, SOCIAL_ACCOUNT_COLS, SOCIAL_CONNECTION_COLS, SOCIAL_POST_COLS } from '@/lib/marketing/prWorkspace';
import type { MarketingCalendarEntry, MarketingCampaign, SocialAccount, SocialAccountStat, SocialConnection, SocialPost } from '@/types/database';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Server-side loaders for the Marketing & PR workspace, shared by the pages (first render) and
// the API routes (reloads), so both always return the same shape. All reads go through the
// service-role client: the callers have already checked the role (MARKETING_READ_ROLES).

// Row shapes as selected by the *_COLS lists (soft-deleted rows are never returned).
export type SocialAccountRow = Omit<SocialAccount, 'deleted_at' | 'external_token_enc'>;
export type SocialConnectionRow = Pick<SocialConnection, 'id' | 'provider' | 'external_user_name' | 'token_expires_at' | 'connected_by' | 'last_error' | 'created_at'>;
export type FollowerStatRow = Pick<SocialAccountStat, 'id' | 'account_id' | 'recorded_on' | 'followers'>;
export type SocialPostRow = Omit<SocialPost, 'deleted_at'>;
export type CalendarEntryRow = Omit<MarketingCalendarEntry, 'deleted_at'>;
export type CampaignOption = Pick<MarketingCampaign, 'id' | 'name' | 'start_date' | 'end_date'>;

/** Thrown when a migration-127 table is missing, so the page can say so instead of crashing. */
export class PrWorkspaceNotReady extends Error {}

/**
 * Table missing = migration 127 not applied. Postgres says 42P01; PostgREST answers first with
 * PGRST205 "Could not find the table … in the schema cache".
 */
export function isMissingTable(error: { message: string; code?: string }): boolean {
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message);
}

function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }, where: string): T {
  if (res.error) {
    if (isMissingTable(res.error)) {
      console.warn(`[pr-workspace] ${where}: table missing — apply migration 127`);
      throw new PrWorkspaceNotReady(where);
    }
    console.error(`[pr-workspace] ${where}:`, res.error.message);
    throw new Error(`Could not load ${where}`);
  }
  return (res.data ?? []) as T;
}

export async function loadCampaignOptions(admin: any): Promise<CampaignOption[]> {
  return check<CampaignOption[]>(
    await admin.from('marketing_campaigns').select('id, name, start_date, end_date').is('deleted_at', null).order('name').limit(500),
    'campaigns',
  );
}

export async function loadSocialData(admin: any) {
  const [accounts, posts, stats, connections] = await Promise.all([
    admin.from('social_accounts').select(SOCIAL_ACCOUNT_COLS).is('deleted_at', null).order('platform').order('handle'),
    admin.from('social_posts').select(SOCIAL_POST_COLS).is('deleted_at', null)
      .order('planned_on', { ascending: false, nullsFirst: true }).order('created_at', { ascending: false }).limit(1000),
    admin.from('social_account_stats').select('id, account_id, recorded_on, followers')
      .order('recorded_on', { ascending: false }).limit(5000),
    admin.from('social_connections').select(SOCIAL_CONNECTION_COLS).is('revoked_at', null).order('created_at'),
  ]);
  return {
    accounts: check<SocialAccountRow[]>(accounts, 'social accounts'),
    posts: check<SocialPostRow[]>(posts, 'social posts'),
    stats: check<FollowerStatRow[]>(stats, 'follower history'),
    connections: check<SocialConnectionRow[]>(connections, 'connections'),
  };
}

/** Everything that lands on the calendar between two dates (inclusive). */
export async function loadCalendarRange(admin: any, from: string, to: string) {
  const [entries, posts, campaigns] = await Promise.all([
    // Overlaps the range: starts before it ends, and ends (or, for a one-day entry, starts) after it starts.
    admin.from('marketing_calendar_entries').select(CALENDAR_COLS).is('deleted_at', null)
      .lte('starts_on', to).or(`ends_on.gte.${from},and(ends_on.is.null,starts_on.gte.${from})`)
      .order('starts_on').order('start_time', { nullsFirst: true }).limit(1000),
    admin.from('social_posts').select('id, title, status, planned_on, published_on, account_id').is('deleted_at', null)
      .or(`and(planned_on.gte.${from},planned_on.lte.${to}),and(published_on.gte.${from},published_on.lte.${to})`).limit(1000),
    admin.from('marketing_campaigns').select('id, name, start_date, end_date').is('deleted_at', null)
      .not('start_date', 'is', null).lte('start_date', to)
      .or(`end_date.gte.${from},and(end_date.is.null,start_date.gte.${from})`).limit(200),
  ]);
  return {
    entries: check<CalendarEntryRow[]>(entries, 'calendar entries'),
    posts: check<Pick<SocialPostRow, 'id' | 'title' | 'status' | 'planned_on' | 'published_on' | 'account_id'>[]>(posts, 'social posts'),
    campaigns: check<CampaignOption[]>(campaigns, 'campaigns'),
  };
}

/** Anyone on the team may edit; deleting is for whoever created the row, or a Marketing manager. */
export function canDelete(role: string, userId: string, createdBy: string | null): boolean {
  return MARKETING_MANAGE_ROLES.includes(role) || createdBy === userId;
}

/** Logs the database error and returns a message that names the action, not the schema. */
export function dbError(where: string, error: { message: string; code?: string }) {
  console.error(`[pr-workspace] ${where}:`, error.message);
  if (error.code === '23505') return NextResponse.json({ error: 'That already exists' }, { status: 409 });
  if (error.code === '23503') return NextResponse.json({ error: 'The selected account or campaign no longer exists' }, { status: 400 });
  if (isMissingTable(error)) return NextResponse.json({ error: 'This feature is not set up yet (migration 127).' }, { status: 503 });
  return NextResponse.json({ error: `Could not ${where}` }, { status: 500 });
}
