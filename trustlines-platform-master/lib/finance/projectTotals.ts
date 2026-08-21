
import type { CurrencyCode } from '@/types/database';

export const PROJECT_FINANCE_READ_ROLES = ['ops_manager', 'general_manager', 'accountant', 'accounting', 'trustlines_pm'] as const;

const CURS: CurrencyCode[] = ['USD', 'TL', 'EUR'];

export interface ProjectFinance {
  production: { pfUsd: number; pfTl: number; invoiceUsd: number; invoiceTl: number; expensesUsd: number; expensesTl: number };
  supplierInvoices: Record<CurrencyCode, number>;
  supplierPayments: Record<CurrencyCode, number>;
  supplierBalance: Record<CurrencyCode, number>;
  trustExpenses: Record<CurrencyCode, number>;
}

function zeroCur(): Record<CurrencyCode, number> {
  return { USD: 0, TL: 0, EUR: 0 };
}

type PiRow = { pf_usd: number | null; pf_tl: number | null; invoice: number | null; invoice_tl: number | null; expenses_usd: number | null; expenses_tl: number | null };
type MoneyRow = { currency: string; amount: number | null };

export function buildProjectFinance(
  productionItems: PiRow[],
  supplierInvoices: MoneyRow[],
  supplierPayments: MoneyRow[],
  trustExpenses: MoneyRow[],
): ProjectFinance {
  const production = { pfUsd: 0, pfTl: 0, invoiceUsd: 0, invoiceTl: 0, expensesUsd: 0, expensesTl: 0 };
  for (const it of productionItems) {
    production.pfUsd += Number(it.pf_usd) || 0;
    production.pfTl += Number(it.pf_tl) || 0;
    production.invoiceUsd += Number(it.invoice) || 0;
    production.invoiceTl += Number(it.invoice_tl) || 0;
    production.expensesUsd += Number(it.expenses_usd) || 0;
    production.expensesTl += Number(it.expenses_tl) || 0;
  }

  const sumByCur = (rows: MoneyRow[]): Record<CurrencyCode, number> => {
    const acc = zeroCur();
    for (const r of rows) {
      const cur = (CURS as string[]).includes(r.currency) ? (r.currency as CurrencyCode) : 'USD';
      acc[cur] += Number(r.amount) || 0;
    }
    return acc;
  };

  const supplierInvoicesT = sumByCur(supplierInvoices);
  const supplierPaymentsT = sumByCur(supplierPayments);
  const supplierBalance = zeroCur();
  for (const c of CURS) supplierBalance[c] = supplierInvoicesT[c] - supplierPaymentsT[c];

  return {
    production,
    supplierInvoices: supplierInvoicesT,
    supplierPayments: supplierPaymentsT,
    supplierBalance,
    trustExpenses: sumByCur(trustExpenses),
  };
}
