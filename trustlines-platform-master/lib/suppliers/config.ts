
import type { CurrencyCode, SupplierInvoice, SupplierPayment } from '@/types/database';

export const SUPPLIER_READ_ROLES = ['ops_manager', 'general_manager', 'accountant', 'accounting', 'trustlines_pm'] as const;
export const SUPPLIER_WRITE_ROLES = ['ops_manager', 'general_manager', 'accountant', 'accounting'] as const;

export const CURRENCIES: CurrencyCode[] = ['USD', 'TL', 'EUR'];
export const PAYMENT_METHODS = ['bank_transfer', 'cash', 'check', 'other'] as const;
export const INVOICE_STATUSES = ['unpaid', 'partial', 'paid'] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  check: 'Check',
  other: 'Other',
};

export type CurrencyTotals = Record<CurrencyCode, { invoiced: number; paid: number; balance: number }>;

function emptyTotals(): CurrencyTotals {
  return {
    USD: { invoiced: 0, paid: 0, balance: 0 },
    TL: { invoiced: 0, paid: 0, balance: 0 },
    EUR: { invoiced: 0, paid: 0, balance: 0 },
  };
}

export function computeTotals(
  invoices: Pick<SupplierInvoice, 'currency' | 'amount'>[],
  payments: Pick<SupplierPayment, 'currency' | 'amount'>[],
): CurrencyTotals {
  const t = emptyTotals();
  for (const inv of invoices) {
    const cur = (CURRENCIES as string[]).includes(inv.currency) ? inv.currency : 'USD';
    t[cur].invoiced += Number(inv.amount) || 0;
  }
  for (const pay of payments) {
    const cur = (CURRENCIES as string[]).includes(pay.currency) ? pay.currency : 'USD';
    t[cur].paid += Number(pay.amount) || 0;
  }
  for (const cur of CURRENCIES) t[cur].balance = t[cur].invoiced - t[cur].paid;
  return t;
}

export function invoiceStatusFor(amount: number, paid: number): 'unpaid' | 'partial' | 'paid' {
  if (paid <= 0) return 'unpaid';
  if (paid + 0.001 >= amount) return 'paid';
  return 'partial';
}
