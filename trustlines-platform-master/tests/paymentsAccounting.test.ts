import { describe, expect, it } from 'vitest';
import { paymentState, remainderFor, rowAccounting } from '@/lib/production/paymentsAccounting';
import { cleanPaymentPatch } from '@/lib/production/paymentFields';

const signed = { pfSignStatus: 'SIGNED' };

describe('rowAccounting — Accounting (Trust System supplier rules)', () => {
  it('remaining = invoice − paid, in USD when the row has no PF/TL', () => {
    const a = rowAccounting({ ...signed, status: 'ORDERED', invoice: 1000, paidUsd1: 300, paidUsd2: 200 });
    expect(a).toMatchObject({ remainingUsd: 500, remainingTl: 0, notOrderedUsd: 0, notSigned: false });
  });

  it('a TL row (PF/TL set) counts its invoice in TL', () => {
    const a = rowAccounting({ ...signed, status: 'ORDERED', pfTl: 900, invoice: 1056, paidTl1: 56 });
    expect(a.remainingTl).toBe(1000);
    expect(a.remainingUsd).toBe(0);
  });

  it('never goes below zero', () => {
    expect(rowAccounting({ ...signed, status: 'ORDERED', invoice: 100, paidUsd1: 150 }).remainingUsd).toBe(0);
  });

  it('PF not signed: "NOT SIGNED", the invoice goes to Not Ordered', () => {
    const a = rowAccounting({ pfSignStatus: 'NOT_SIGNED', status: 'ORDERED', invoice: 700, paidUsd1: 100 });
    expect(a).toMatchObject({ notSigned: true, remainingUsd: 0, notOrderedUsd: 700 });
  });

  it('NOT_ORDERED: the invoice goes to Not Ordered', () => {
    expect(rowAccounting({ ...signed, status: 'NOT_ORDERED', invoice: 700 })).toMatchObject({ remainingUsd: 0, notOrderedUsd: 700 });
  });
});

describe('rowAccounting — Due Payment', () => {
  it('WAITING_PAYMENT: the advance by the payment rule, less what was paid', () => {
    expect(rowAccounting({ ...signed, status: 'WAITING_PAYMENT', invoice: 1000, paymentRule: '30' }).dueUsd).toBe(300);
    expect(rowAccounting({ ...signed, status: 'WAITING_PAYMENT', invoice: 1000, paymentRule: '30%', paidUsd1: 100 }).dueUsd).toBe(200);
  });

  it('goods ready / received / sent: all of it is due', () => {
    expect(rowAccounting({ ...signed, status: 'RECEIVED', invoice: 1000, paidUsd1: 300 }).dueUsd).toBe(700);
    expect(rowAccounting({ ...signed, status: 'SENT', pfTl: 1, invoice: 500 }).dueTl).toBe(500);
  });

  it('nothing is due when ordered, not ordered, on hold or the PF is not signed', () => {
    expect(rowAccounting({ ...signed, status: 'ORDERED', invoice: 1000 }).dueUsd).toBe(0);
    expect(rowAccounting({ ...signed, status: 'HOLD_PM', invoice: 1000 }).dueUsd).toBe(0);
    expect(rowAccounting({ pfSignStatus: 'NOT_SIGNED', status: 'RECEIVED', invoice: 1000 }).dueUsd).toBe(0);
  });
});

describe('Rem shortcut and Payment filter', () => {
  it('remainder = invoice − the other payment', () => {
    const a = rowAccounting({ ...signed, status: 'ORDERED', invoice: 1000, paidUsd2: 400 });
    expect(remainderFor(a, 'paid_usd1')).toBe(600);
    expect(remainderFor(a, 'paid_tl1')).toBe(0);
  });

  it('payment state against PF/USD', () => {
    expect(paymentState({ pfUsd: 1000 })).toBe('not_paid');
    expect(paymentState({ pfUsd: 1000, paidUsd1: 400 })).toBe('partially_paid');
    expect(paymentState({ pfUsd: 1000, paidUsd1: 400, paidUsd2: 600 })).toBe('fully_paid');
  });
});

describe('cleanPaymentPatch', () => {
  it('keeps 0 apart from empty, rounds to cents, accepts "1,234.5"', () => {
    expect(cleanPaymentPatch({ paid_usd1: 0 })).toEqual({ update: { paid_usd1: 0 } });
    expect(cleanPaymentPatch({ paid_usd1: '' })).toEqual({ update: { paid_usd1: null } });
    expect(cleanPaymentPatch({ paid_tl2: '1,234.567' })).toEqual({ update: { paid_tl2: 1234.57 } });
  });

  it('dates, texts and the QuickBook toggle', () => {
    expect(cleanPaymentPatch({ invoice_date: '2026-11-18T10:00:00Z' })).toEqual({ update: { invoice_date: '2026-11-18' } });
    expect(cleanPaymentPatch({ invoice_number: '  SHN-1 ' })).toEqual({ update: { invoice_number: 'SHN-1' } });
    expect(cleanPaymentPatch({ quick_book: 'Done' })).toEqual({ update: { quick_book: 'Done' } });
    expect(cleanPaymentPatch({ quick_book: '' })).toEqual({ update: { quick_book: null } });
  });

  it('refuses bad values and fields it does not own', () => {
    expect('error' in cleanPaymentPatch({ paid_usd1: -5 })).toBe(true);
    expect('error' in cleanPaymentPatch({ invoice_date: '18/11/2026' })).toBe(true);
    expect('error' in cleanPaymentPatch({ quick_book: 'Yes' })).toBe(true);
    expect('error' in cleanPaymentPatch({ pf_usd: 10 })).toBe(true);
    expect('error' in cleanPaymentPatch({})).toBe(true);
  });
});
