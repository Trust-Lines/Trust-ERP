import { describe, it, expect } from 'vitest';
import {
  daysBetween, engagementRate, followerGrowth, isIsoDate, monthGridRange, parseCalendarEntry, parseFollowerStat,
  parseSocialAccount, parseSocialPost,
} from '@/lib/marketing/prWorkspace';

const ok = <T,>(r: { value: T } | { error: string }): T => {
  if ('error' in r) throw new Error(r.error);
  return r.value;
};

describe('dates', () => {
  it('accepts real calendar dates only', () => {
    expect(isIsoDate('2026-10-27')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('27/10/2026')).toBe(false);
  });

  it('builds a Monday-first 6-week grid around the month', () => {
    // 1 Oct 2026 is a Thursday → the grid opens on Monday 28 Sep and holds 42 days.
    expect(monthGridRange('2026-10')).toEqual({ from: '2026-09-28', to: '2026-11-08' });
    expect(daysBetween('2026-09-28', '2026-11-08')).toHaveLength(42);
  });

  it('walks days across month ends without time-zone drift', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });
});

describe('calendar entries', () => {
  const base = { title: 'NACS Show', kind: 'event', starts_on: '2026-10-06' };

  it('needs a title and a start date', () => {
    expect(parseCalendarEntry({ ...base, title: ' ' })).toEqual({ error: 'Title is required' });
    expect(parseCalendarEntry({ ...base, starts_on: '' })).toEqual({ error: 'Pick a start date' });
  });

  it('rejects an end date or end time before the start', () => {
    expect(parseCalendarEntry({ ...base, ends_on: '2026-10-05' })).toEqual({ error: 'End date can’t be before the start date' });
    expect(parseCalendarEntry({ ...base, start_time: '14:00', end_time: '09:00' })).toEqual({ error: 'End time can’t be before the start time' });
    // Different days: an earlier clock time on the last day is fine.
    expect('value' in parseCalendarEntry({ ...base, ends_on: '2026-10-08', start_time: '14:00', end_time: '09:00' })).toBe(true);
  });

  it('stores a one-day entry without an end date', () => {
    expect(ok(parseCalendarEntry({ ...base, ends_on: '2026-10-06' })).ends_on).toBeNull();
  });

  it('checks a PATCH against the stored row', () => {
    const stored = { starts_on: '2026-10-06', ends_on: '2026-10-08', start_time: null, end_time: null };
    expect(parseCalendarEntry({ starts_on: '2026-10-10' }, true, stored)).toEqual({ error: 'End date can’t be before the start date' });
    expect(ok(parseCalendarEntry({ title: 'Renamed' }, true, stored))).toEqual({ title: 'Renamed' });
  });
});

describe('social posts', () => {
  it('defaults to an idea and fills the publish date from the plan', () => {
    expect(ok(parseSocialPost({ title: 'Booth recap' })).status).toBe('idea');
    expect(ok(parseSocialPost({ title: 'Booth recap', status: 'published', planned_on: '2026-10-07' })).published_on).toBe('2026-10-07');
  });

  it('validates links and counts', () => {
    expect(parseSocialPost({ title: 'x', post_url: 'javascript:alert(1)' })).toEqual({ error: 'Post link must be a web link (https://…)' });
    expect(parseSocialPost({ title: 'x', likes: '-3' })).toEqual({ error: 'Likes must be a whole number of 0 or more' });
    expect(ok(parseSocialPost({ title: 'x', likes: '' })).likes).toBeNull();
  });

  it('only changes the fields a PATCH sends', () => {
    expect(ok(parseSocialPost({ likes: 12 }, true))).toEqual({ likes: 12 });
  });

  it('computes engagement rate from impressions, then reach', () => {
    expect(engagementRate({ impressions: 1000, likes: 40, comments: 5, shares: 5 })).toBe(5);
    expect(engagementRate({ reach: 200, likes: 10 })).toBe(5);
    expect(engagementRate({ likes: 10 })).toBeNull();
  });
});

describe('accounts and followers', () => {
  it('requires a known platform and a handle', () => {
    expect(parseSocialAccount({ platform: 'myspace', handle: '@t' })).toEqual({ error: 'Pick a platform' });
    expect(ok(parseSocialAccount({ platform: 'instagram', handle: ' @tlines ' })).handle).toBe('@tlines');
  });

  it('validates a follower count', () => {
    expect(parseFollowerStat({ recorded_on: '2026-10-27', followers: '' })).toEqual({ error: 'Followers is required' });
    expect(ok(parseFollowerStat({ recorded_on: '2026-10-27', followers: '1520' }))).toEqual({ recorded_on: '2026-10-27', followers: 1520 });
  });

  it('measures growth between the two latest counts', () => {
    expect(followerGrowth([
      { recorded_on: '2026-09-01', followers: 1000 },
      { recorded_on: '2026-10-01', followers: 1100 },
      { recorded_on: '2026-08-01', followers: 900 },
    ])).toEqual({ latest: 1100, changePct: 10 });
    expect(followerGrowth([])).toEqual({ latest: null, changePct: null });
  });
});
