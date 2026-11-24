import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { groupPasswordOk, groupTokenOk, makeGroupToken, GROUP_UNLOCK_SECONDS } from '@/lib/it/groupLock';
import { cleanSetLabel, nextSetName, parsePendingGroup, PENDING_GROUP_MAX_AGE } from '@/lib/it/groups';

const KEY = Buffer.alloc(32, 7).toString('base64');

describe('IT group password', () => {
  const saved = { key: process.env.APP_ENCRYPTION_KEY, pw: process.env.IT_GROUP_PASSWORD };
  beforeEach(() => { process.env.APP_ENCRYPTION_KEY = KEY; delete process.env.IT_GROUP_PASSWORD; });
  afterEach(() => {
    if (saved.key === undefined) delete process.env.APP_ENCRYPTION_KEY; else process.env.APP_ENCRYPTION_KEY = saved.key;
    if (saved.pw === undefined) delete process.env.IT_GROUP_PASSWORD; else process.env.IT_GROUP_PASSWORD = saved.pw;
  });

  it('accepts the default password and rejects others', () => {
    expect(groupPasswordOk('12348765')).toBe(true);
    expect(groupPasswordOk('12348766')).toBe(false);
    expect(groupPasswordOk('')).toBe(false);
    expect(groupPasswordOk(12348765)).toBe(false);
  });

  it('uses IT_GROUP_PASSWORD when set', () => {
    process.env.IT_GROUP_PASSWORD = 'other-secret';
    expect(groupPasswordOk('other-secret')).toBe(true);
    expect(groupPasswordOk('12348765')).toBe(false);
  });

  it('signs an unlock bound to the user that expires', () => {
    const now = Date.now();
    const t = makeGroupToken('user-a', now)!;
    expect(groupTokenOk(t, 'user-a', now)).toBe(true);
    expect(groupTokenOk(t, 'user-b', now)).toBe(false);
    expect(groupTokenOk(t, 'user-a', now + (GROUP_UNLOCK_SECONDS + 5) * 1000)).toBe(false);
    const [exp] = t.split('.');
    expect(groupTokenOk(`${Number(exp) + 9999}.${t.split('.')[1]}`, 'user-a', now)).toBe(false);
    expect(groupTokenOk(undefined, 'user-a', now)).toBe(false);
  });

  it('cannot unlock without APP_ENCRYPTION_KEY', () => {
    delete process.env.APP_ENCRYPTION_KEY;
    expect(makeGroupToken('user-a')).toBeNull();
    expect(groupTokenOk('1.abc', 'user-a')).toBe(false);
  });
});

describe('IT sets', () => {
  it('cleans set names', () => {
    expect(cleanSetLabel(undefined)).toEqual({ value: null });
    expect(cleanSetLabel('  PC   1 ')).toEqual({ value: 'PC 1' });
    expect(cleanSetLabel('   ')).toEqual({ value: null });
    expect(cleanSetLabel('x'.repeat(41)).error).toBeTruthy();
    expect(cleanSetLabel(5).error).toBeTruthy();
  });

  it('suggests the next free set name', () => {
    expect(nextSetName([])).toBe('Set 1');
    expect(nextSetName(['Set 1', 'set 2', null, 'PC 1'])).toBe('Set 3');
  });

  it('reads a pending scan-to-group and drops stale ones', () => {
    const now = Date.now();
    const p = { anchorId: 'a', anchorName: 'PC', setLabel: 'Set 1', startedAt: now };
    expect(parsePendingGroup(JSON.stringify(p), now)).toEqual(p);
    expect(parsePendingGroup(JSON.stringify(p), now + PENDING_GROUP_MAX_AGE + 1)).toBeNull();
    expect(parsePendingGroup('{bad', now)).toBeNull();
    expect(parsePendingGroup(null, now)).toBeNull();
  });
});
