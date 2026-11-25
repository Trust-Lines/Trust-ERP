import { describe, expect, it } from 'vitest';
import { formatMoney, subscriptionTotals, type TotalsInput } from '@/lib/it/subscriptionTotals';

const sub = (p: Partial<TotalsInput>): TotalsInput => ({ active: true, amount: 100, currency: 'USD', billingCycle: 'monthly', dueDate: null, ...p });

describe('subscriptionTotals', () => {
  it('counts monthly every month and yearly only in its renewal month', () => {
    const t = subscriptionTotals([
      sub({ amount: 100 }),
      sub({ amount: 240, billingCycle: 'yearly', dueDate: '2026-11-20' }),
      sub({ amount: 1200, billingCycle: 'yearly', dueDate: '2027-03-01' }),
    ], '2026-11');
    expect(t.USD.dueThisMonth).toBe(340);
    expect(t.USD.dueCount).toBe(2);
    expect(t.USD.monthlyTotal).toBe(100 + 20 + 100);
    expect(t.USD.count).toBe(3);
  });

  it('keeps USD and TRY apart and skips cancelled, empty and other currencies', () => {
    const t = subscriptionTotals([
      sub({ currency: 'TRY', amount: 500 }),
      sub({ currency: null, amount: 10 }),
      sub({ active: false }),
      sub({ amount: null }),
      sub({ currency: 'EUR' }),
      sub({ billingCycle: null, amount: 5 }),
    ], '2026-11');
    expect(t.TRY).toEqual({ dueThisMonth: 500, dueCount: 1, monthlyTotal: 500, count: 1 });
    expect(t.USD.dueThisMonth).toBe(15);
  });

  it('rounds to cents', () => {
    expect(subscriptionTotals([sub({ amount: 100, billingCycle: 'yearly' })], '2026-11').USD.monthlyTotal).toBe(8.33);
  });
});

describe('formatMoney', () => {
  it('formats with the symbol and separators', () => {
    expect(formatMoney(1240, 'USD')).toBe('$1,240');
    expect(formatMoney(12500.5, 'TRY')).toBe('₺12,500.50');
  });
});
