
import type { CurrencyCode, TrustExpense } from '@/types/database';

export const EXPENSE_READ_ROLES = ['ops_manager', 'general_manager', 'accountant', 'accounting', 'trustlines_pm'] as const;
export const EXPENSE_WRITE_ROLES = ['ops_manager', 'general_manager', 'accountant', 'accounting'] as const;

export const EXPENSE_CATEGORIES = [
  'customs', 'logistics', 'office', 'travel', 'salary', 'rent', 'utilities', 'marketing', 'tax', 'other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  customs: 'Customs', logistics: 'Logistics', office: 'Office', travel: 'Travel',
  salary: 'Salary', rent: 'Rent', utilities: 'Utilities', marketing: 'Marketing', tax: 'Tax', other: 'Other',
};

export const CURRENCIES: CurrencyCode[] = ['USD', 'TL', 'EUR'];

export type CurrencyTotals = Record<CurrencyCode, { total: number; paid: number; unpaid: number }>;

export function computeExpenseTotals(rows: Pick<TrustExpense, 'currency' | 'amount' | 'is_paid'>[]): CurrencyTotals {
  const t: CurrencyTotals = {
    USD: { total: 0, paid: 0, unpaid: 0 },
    TL: { total: 0, paid: 0, unpaid: 0 },
    EUR: { total: 0, paid: 0, unpaid: 0 },
  };
  for (const r of rows) {
    const cur = (CURRENCIES as string[]).includes(r.currency) ? r.currency : 'USD';
    const amt = Number(r.amount) || 0;
    t[cur].total += amt;
    if (r.is_paid) t[cur].paid += amt; else t[cur].unpaid += amt;
  }
  return t;
}
