import { describe, expect, it } from 'vitest';
import { cleanSubscriptionUsers, MAX_SUB_USERS } from '@/lib/it/subscriptions';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('cleanSubscriptionUsers', () => {
  it('keeps people once and typed names once', () => {
    const r = cleanSubscriptionUsers([{ personId: A }, { personId: B }, { personId: A }, { name: '  Ali   Veli ' }, { name: 'ali veli' }]);
    expect(r).toEqual({ value: [
      { personId: A, name: null },
      { personId: B, name: null },
      { personId: null, name: 'Ali Veli' },
    ] });
  });

  it('allows an empty list (no users)', () => {
    expect(cleanSubscriptionUsers([])).toEqual({ value: [] });
  });

  it('rejects bad input', () => {
    expect(cleanSubscriptionUsers('x')).toHaveProperty('error');
    expect(cleanSubscriptionUsers([{ name: '   ' }])).toHaveProperty('error');
    expect(cleanSubscriptionUsers([{ personId: 'not-a-uuid' }])).toHaveProperty('error');
    expect(cleanSubscriptionUsers([{ name: 'x'.repeat(121) }])).toHaveProperty('error');
    expect(cleanSubscriptionUsers(Array.from({ length: MAX_SUB_USERS + 1 }, (_, i) => ({ name: `P${i}` })))).toHaveProperty('error');
  });
});
