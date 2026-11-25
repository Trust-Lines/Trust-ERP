import { describe, expect, it } from 'vitest';
import { cleanSubscriptionInput, cleanSubscriptionUsers, hasBilling, MAX_SUB_USERS, usedSeats, withoutBilling } from '@/lib/it/subscriptions';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('cleanSubscriptionUsers', () => {
  it('keeps people once and typed names once', () => {
    const r = cleanSubscriptionUsers([{ personId: A }, { personId: B }, { personId: A }, { name: '  Ali   Veli ' }, { name: 'ali veli' }]);
    expect(r).toEqual({ value: [
      { personId: A, name: null, teamSize: null },
      { personId: B, name: null, teamSize: null },
      { personId: null, name: 'Ali Veli', teamSize: null },
    ] });
  });

  it('keeps a team with its head count', () => {
    expect(cleanSubscriptionUsers([{ name: 'Team Syria', teamSize: 22 }])).toEqual({ value: [{ personId: null, name: 'Team Syria', teamSize: 22 }] });
    expect(cleanSubscriptionUsers([{ name: 'Team Syria', teamSize: '3' }])).toEqual({ value: [{ personId: null, name: 'Team Syria', teamSize: 3 }] });
  });

  it('allows an empty list (no users)', () => {
    expect(cleanSubscriptionUsers([])).toEqual({ value: [] });
  });

  it('rejects bad input', () => {
    expect(cleanSubscriptionUsers('x')).toHaveProperty('error');
    expect(cleanSubscriptionUsers([{ name: '   ' }])).toHaveProperty('error');
    expect(cleanSubscriptionUsers([{ personId: 'not-a-uuid' }])).toHaveProperty('error');
    expect(cleanSubscriptionUsers([{ name: 'x'.repeat(121) }])).toHaveProperty('error');
    expect(cleanSubscriptionUsers([{ name: 'Team', teamSize: 0 }])).toHaveProperty('error');
    expect(cleanSubscriptionUsers([{ name: 'Team', teamSize: 1.5 }])).toHaveProperty('error');
    expect(cleanSubscriptionUsers(Array.from({ length: MAX_SUB_USERS + 1 }, (_, i) => ({ name: `P${i}` })))).toHaveProperty('error');
  });
});

describe('usedSeats', () => {
  it('counts one per person or name and a team by its size', () => {
    expect(usedSeats([])).toBe(0);
    expect(usedSeats([{ teamSize: null }, { teamSize: null }, { teamSize: 22 }])).toBe(24);
  });
});

describe('cleanSubscriptionInput billing', () => {
  it('reads amount, currency, cycle and maximum users', () => {
    const r = cleanSubscriptionInput({ service: 'Claude', amount: '99,999', currency: 'USD', billingCycle: 'yearly', seats: '22' }, false);
    expect(r).toHaveProperty('value');
    const v = (r as { value: Record<string, unknown> }).value;
    expect(v).toMatchObject({ service: 'Claude', amount: 100, currency: 'USD', billing_cycle: 'yearly', seats: 22 });
  });

  it('clears empty billing and leaves brand colour alone unless sent', () => {
    const v = (cleanSubscriptionInput({ amount: '', currency: '', billingCycle: '' }, true) as { value: Record<string, unknown> }).value;
    expect(v).toEqual({ amount: null, currency: null, billing_cycle: null });
    expect(hasBilling(v)).toBe(false);
    expect(withoutBilling({ service: 'x', ...v })).toEqual({ service: 'x' });
  });

  it('rejects bad billing', () => {
    expect(cleanSubscriptionInput({ service: 'x', amount: '-1' }, false)).toHaveProperty('error');
    expect(cleanSubscriptionInput({ service: 'x', currency: 'JPY' }, false)).toHaveProperty('error');
    expect(cleanSubscriptionInput({ service: 'x', billingCycle: 'weekly' }, false)).toHaveProperty('error');
  });
});
