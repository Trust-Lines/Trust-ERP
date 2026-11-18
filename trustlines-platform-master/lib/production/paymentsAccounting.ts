// Payments page (the accounting "green table"): the computed columns of one production row — the
// Trust System's Supplier accounting rules (docs: "Muhasebe (Suppliers) Modülü"). Browser-safe.
//
// Currency: like the Trust System, a row's invoice is in TL when the row has a PF/TL price, else in
// USD (the copied data was entered that way; invoiceTl is not used here).
//
//   Accounting  remaining = max(0, invoice − paid 1 − paid 2) per currency
//               PF not signed  → remaining shows "NOT SIGNED", the invoice goes to Not Ordered
//               NOT_ORDERED    → the invoice goes to Not Ordered, remaining 0
//   Payments    due: PF not signed → 0
//                    WAITING_PAYMENT → max(0, invoice × payment rule % − paid)   (the advance)
//                    goods ready / received / sent → max(0, invoice − paid)      (all of it)
//                    anything else → 0
//               Payments 1 / 2 are the same fields as Paid 1 / 2.
import { normalizeSign, normalizeStatus } from './statuses';
import { toNumber, type PItem } from '@/lib/excel/projectsExcelExport';

export const DUE_ALL_STATUSES = new Set(['READY_TO_RECEIVE', 'RECEIVED', 'READY', 'SENT_TO_TLINES', 'PARTIAL_SENT', 'SENT']);

export interface RowAccounting {
  paidUsd1: number; paidUsd2: number; paidTl1: number; paidTl2: number;
  invoiceUsd: number; invoiceTl: number;
  remainingUsd: number; remainingTl: number;
  notOrderedUsd: number; notOrderedTl: number;
  dueUsd: number; dueTl: number;
  /** PF not signed: the Remaining cell shows "NOT SIGNED". */
  notSigned: boolean;
}

export function rowAccounting(it: PItem): RowAccounting {
  const paidUsd1 = toNumber(it.paidUsd1), paidUsd2 = toNumber(it.paidUsd2);
  const paidTl1 = toNumber(it.paidTl1), paidTl2 = toNumber(it.paidTl2);
  const invoice = toNumber(it.invoice);
  const tlRow = toNumber(it.pfTl) > 0;
  const invoiceUsd = tlRow ? 0 : invoice, invoiceTl = tlRow ? invoice : 0;
  const paidUsd = paidUsd1 + paidUsd2, paidTl = paidTl1 + paidTl2;
  const status = normalizeStatus(it.status);
  const notSigned = normalizeSign(it.pfSignStatus) !== 'SIGNED';

  let remainingUsd = 0, remainingTl = 0, notOrderedUsd = 0, notOrderedTl = 0;
  if (notSigned || status === 'NOT_ORDERED') {
    notOrderedUsd = invoiceUsd; notOrderedTl = invoiceTl;
  } else {
    remainingUsd = Math.max(0, invoiceUsd - paidUsd);
    remainingTl = Math.max(0, invoiceTl - paidTl);
  }

  let dueUsd = 0, dueTl = 0;
  if (!notSigned) {
    if (status === 'WAITING_PAYMENT') {
      const pct = (parseFloat(String(it.paymentRule ?? '').replace('%', '')) || 0) / 100;
      dueUsd = Math.max(0, invoiceUsd * pct - paidUsd);
      dueTl = Math.max(0, invoiceTl * pct - paidTl);
    } else if (DUE_ALL_STATUSES.has(status)) {
      dueUsd = Math.max(0, invoiceUsd - paidUsd);
      dueTl = Math.max(0, invoiceTl - paidTl);
    }
  }
  return { paidUsd1, paidUsd2, paidTl1, paidTl2, invoiceUsd, invoiceTl, remainingUsd, remainingTl, notOrderedUsd, notOrderedTl, dueUsd, dueTl, notSigned };
}

/** "Rem:" shortcut for a paid field: what is left of the invoice after the other payment. */
export function remainderFor(a: RowAccounting, field: 'paid_usd1' | 'paid_usd2' | 'paid_tl1' | 'paid_tl2'): number {
  if (field === 'paid_usd1') return Math.max(0, a.invoiceUsd - a.paidUsd2);
  if (field === 'paid_usd2') return Math.max(0, a.invoiceUsd - a.paidUsd1);
  if (field === 'paid_tl1') return Math.max(0, a.invoiceTl - a.paidTl2);
  return Math.max(0, a.invoiceTl - a.paidTl1);
}

/** Payment filter (USD, against PF/USD): nothing paid, partly paid, fully paid. */
export function paymentState(it: PItem): 'not_paid' | 'partially_paid' | 'fully_paid' {
  const paid = toNumber(it.paidUsd1) + toNumber(it.paidUsd2);
  if (paid === 0) return 'not_paid';
  return toNumber(it.pfUsd) - paid <= 0 ? 'fully_paid' : 'partially_paid';
}
