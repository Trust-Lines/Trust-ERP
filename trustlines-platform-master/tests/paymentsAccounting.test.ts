import { describe, expect, it } from 'vitest';
import { rowAccounting } from '@/lib/production/paymentsAccounting';

describe('rowAccounting (Payments green table, Trust System rule)', () => {
  it('remaining = invoice − paid, in USD when the row has no PF/TL', () => {
    const a = rowAccounting({ status: 'ORDERED', pfSignStatus: 'SIGNED', invoice: 1000, paidUsd1: 300, paidUsd2: 200 });
    expect(a).toMatchObject({ paidUsd1: 300, paidUsd2: 200, remainingUsd: 500, remainingTl: 0, notOrderedUsd: 0, notSigned: false });
  });

  it('a TL deal (PF/TL set) keeps its remaining in TL', () => {
    const a = rowAccounting({ status: 'ORDERED', pfSignStatus: 'SIGNED', pfTl: 900, invoice: 1056, paidTl1: 56 });
    expect(a.remainingTl).toBe(1000);
    expect(a.remainingUsd).toBe(0);
  });

  it('never goes below zero', () => {
    expect(rowAccounting({ status: 'ORDERED', pfSignStatus: 'SIGNED', invoice: 100, paidUsd1: 150 }).remainingUsd).toBe(0);
  });

  it('NOT ORDERED rows move the amount to Not Ordered', () => {
    const a = rowAccounting({ status: 'NOT_ORDERED', pfSignStatus: 'NOT_SIGNED', invoice: 700 });
    expect(a).toMatchObject({ remainingUsd: 0, notOrderedUsd: 700, notSigned: false });
  });

  it('flags a row whose PF is not signed yet', () => {
    expect(rowAccounting({ status: 'ORDERED', pfSignStatus: 'NOT_SIGNED', invoice: 50 }).notSigned).toBe(true);
  });
});
