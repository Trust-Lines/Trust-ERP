// Payments page (the accounting "green table"): the Accounting columns of one production row,
// the same rule as the Trust System's calculateRowAccounting (docs/projects-page-source.md,
// components/AccountingColumns.tsx). Browser-safe, no I/O.
//
//   paid       = 1st + 2nd payment, per currency
//   base       = the row's invoice, in TL when the row has a PF/TL price, else in USD
//   remaining  = max(base − paid, 0)
//   NOT ORDERED rows move their remaining to the "Not Ordered" columns
//   a row whose PF is not signed yet keeps its remaining, flagged (notSigned)
import { normalizeSign, normalizeStatus } from './statuses';
import { toNumber, type PItem } from '@/lib/excel/projectsExcelExport';

export interface RowAccounting {
  paidUsd1: number; paidUsd2: number; paidTl1: number; paidTl2: number;
  remainingUsd: number; remainingTl: number;
  notOrderedUsd: number; notOrderedTl: number;
  notSigned: boolean;
}

export function rowAccounting(it: PItem): RowAccounting {
  const paidUsd1 = toNumber(it.paidUsd1), paidUsd2 = toNumber(it.paidUsd2);
  const paidTl1 = toNumber(it.paidTl1), paidTl2 = toNumber(it.paidTl2);
  const invoice = toNumber(it.invoice);
  const tlDeal = toNumber(it.pfTl) > 0;
  let remainingUsd = Math.max((tlDeal ? 0 : invoice) - paidUsd1 - paidUsd2, 0);
  let remainingTl = Math.max((tlDeal ? invoice : 0) - paidTl1 - paidTl2, 0);
  let notOrderedUsd = 0, notOrderedTl = 0, notSigned = false;
  if (normalizeStatus(it.status) === 'NOT_ORDERED') {
    notOrderedUsd = remainingUsd; notOrderedTl = remainingTl;
    remainingUsd = 0; remainingTl = 0;
  } else if (normalizeSign(it.pfSignStatus) !== 'SIGNED') {
    notSigned = true;
  }
  return { paidUsd1, paidUsd2, paidTl1, paidTl2, remainingUsd, remainingTl, notOrderedUsd, notOrderedTl, notSigned };
}
