// IT → Subscriptions totals (the four cards above the list). Pure, so the page and tests share it.
//
//   Due this month   monthly subscriptions (and those with no cycle set, which the form saves as
//                    monthly) every month; yearly ones only when their next renewal is in the month
//   Monthly total    the average monthly cost: monthly amounts + yearly amounts / 12
//
// Active subscriptions with an amount only. USD and TRY are kept apart (never converted).

export interface TotalsInput {
  active: boolean;
  amount: number | null;
  currency: string | null;
  billingCycle: 'monthly' | 'yearly' | null;
  /** ISO date of the next renewal. */
  dueDate: string | null;
}

export interface CurrencyTotals { dueThisMonth: number; dueCount: number; monthlyTotal: number; count: number }
export type SubscriptionTotals = Record<'USD' | 'TRY', CurrencyTotals>;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** `month` = "2026-11". A subscription with no currency counts as USD (the form's default). */
export function subscriptionTotals(subs: TotalsInput[], month: string): SubscriptionTotals {
  const out: SubscriptionTotals = {
    USD: { dueThisMonth: 0, dueCount: 0, monthlyTotal: 0, count: 0 },
    TRY: { dueThisMonth: 0, dueCount: 0, monthlyTotal: 0, count: 0 },
  };
  for (const s of subs) {
    if (!s.active || s.amount == null || !Number.isFinite(s.amount)) continue;
    const cur = s.currency ?? 'USD';
    if (cur !== 'USD' && cur !== 'TRY') continue;
    const t = out[cur];
    const yearly = s.billingCycle === 'yearly';
    t.count += 1;
    t.monthlyTotal += yearly ? s.amount / 12 : s.amount;
    if (!yearly || (s.dueDate ?? '').slice(0, 7) === month) {
      t.dueThisMonth += s.amount;
      t.dueCount += 1;
    }
  }
  for (const t of Object.values(out)) { t.dueThisMonth = round2(t.dueThisMonth); t.monthlyTotal = round2(t.monthlyTotal); }
  return out;
}

/** "$1,240" / "₺12,500.50". */
export function formatMoney(n: number, currency: 'USD' | 'TRY') {
  const symbol = currency === 'USD' ? '$' : '₺';
  return `${symbol}${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
}
