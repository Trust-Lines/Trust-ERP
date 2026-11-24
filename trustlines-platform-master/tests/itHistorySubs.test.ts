import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { stampPhoneDates } from '@/lib/it/phones';
import { recordAssignment } from '@/lib/it/assignments';
import { cleanSubscriptionInput, subscriptionAudit } from '@/lib/it/subscriptions';
import { decryptToken } from '@/lib/crypto/secrets';

const NOW = new Date('2026-11-24T10:00:00Z');

describe('stampPhoneDates', () => {
  it('dates a new line, its holder and phone today', () => {
    expect(stampPhoneDates({ holder_id: 'u1', device_name: 'iPhone' }, null, NOW))
      .toEqual({ start_date: '2026-11-24', holder_since: '2026-11-24', device_assigned_at: '2026-11-24' });
    expect(stampPhoneDates({ holder_id: null, device_name: null }, null, NOW)).toEqual({ start_date: '2026-11-24' });
  });

  it('only re-dates what changed on edit', () => {
    const before = { holder_id: 'u1', device_name: 'iPhone' };
    expect(stampPhoneDates({ holder_id: 'u1', device_name: 'iPhone', notes: 'x' }, before, NOW)).toEqual({});
    expect(stampPhoneDates({ holder_id: 'u2' }, before, NOW)).toEqual({ holder_since: '2026-11-24' });
    expect(stampPhoneDates({ holder_id: null, device_name: null }, before, NOW)).toEqual({ holder_since: null, device_assigned_at: null });
  });
});

/** Minimal fake of the Supabase query builder for it_assignments. */
function fakeAdmin(open: { id: string; person_id: string | null; device_name: string | null }[]) {
  const calls: { op: string; payload?: unknown }[] = [];
  const builder = (op: string, payload?: unknown) => {
    const b: Record<string, unknown> = {};
    const chain = () => b;
    Object.assign(b, {
      eq: chain, is: chain, in: chain,
      limit: async () => ({ data: open }),
      then: (res: (v: unknown) => void) => { calls.push({ op, payload }); res({ data: null, error: null }); },
    });
    return b;
  };
  return {
    calls,
    admin: {
      from: () => ({
        select: () => builder('select'),
        update: (p: unknown) => builder('update', p),
        insert: async (p: unknown) => { calls.push({ op: 'insert', payload: p }); return { error: null }; },
      }),
    },
  };
}

describe('recordAssignment', () => {
  it('opens a spell for the first holder', async () => {
    const f = fakeAdmin([]);
    await recordAssignment(f.admin, { kind: 'item', assetId: 'a', personId: 'u1', actorId: 'me' });
    expect(f.calls.map(c => c.op)).toEqual(['insert']);
  });

  it('does nothing when the holder is unchanged', async () => {
    const f = fakeAdmin([{ id: 's1', person_id: 'u1', device_name: null }]);
    await recordAssignment(f.admin, { kind: 'item', assetId: 'a', personId: 'u1', actorId: 'me' });
    expect(f.calls).toEqual([]);
  });

  it('closes the old spell and opens a new one on a new holder or phone', async () => {
    const f = fakeAdmin([{ id: 's1', person_id: 'u1', device_name: 'iPhone 12' }]);
    await recordAssignment(f.admin, { kind: 'phone_line', assetId: 'l', personId: 'u1', deviceName: 'iPhone 17', actorId: 'me' });
    expect(f.calls.map(c => c.op)).toEqual(['update', 'insert']);
  });

  it('only closes the spell when freed', async () => {
    const f = fakeAdmin([{ id: 's1', person_id: 'u1', device_name: null }]);
    await recordAssignment(f.admin, { kind: 'item', assetId: 'a', personId: null, actorId: 'me' });
    expect(f.calls.map(c => c.op)).toEqual(['update']);
  });
});

describe('cleanSubscriptionInput', () => {
  beforeEach(() => { vi.stubEnv('APP_ENCRYPTION_KEY', randomBytes(32).toString('base64')); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it('validates and maps fields', () => {
    expect(cleanSubscriptionInput({ service: ' ' }, false)).toEqual({ error: 'Enter the service name' });
    expect(cleanSubscriptionInput({ service: 'X', cardLast4: '12a4' }, false)).toEqual({ error: 'Card: the last 4 digits only' });
    expect(cleanSubscriptionInput({ service: 'X', logoUrl: 'http://x/a.png' }, false)).toEqual({ error: 'The logo must be an https:// link' });
    const r = cleanSubscriptionInput({ service: 'Adobe', seats: '5', cardLast4: '4242', brandColor: '#DA1F26', dueDate: '2026-12-01', evil: 1 }, false);
    if ('error' in r) throw new Error(r.error);
    expect(r.value).toMatchObject({ service: 'Adobe', seats: 5, card_last4: '4242', brand_color: '#DA1F26', due_date: '2026-12-01' });
    expect(r.value).not.toHaveProperty('evil');
  });

  it('encrypts the password and keeps it out of the audit', () => {
    const r = cleanSubscriptionInput({ password: 'hunter2' }, true);
    if ('error' in r) throw new Error(r.error);
    expect(decryptToken(r.value.password_enc as string)).toBe('hunter2');
    expect(JSON.stringify(subscriptionAudit(r.value))).not.toContain('hunter2');
    expect(r.value).not.toHaveProperty('service');
  });
});
