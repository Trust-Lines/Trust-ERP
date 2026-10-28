import { describe, it, expect } from 'vitest';
import { defaultContractTerms, estimateTotals, formatMoney, parseEstimate } from '@/lib/sales/documents';
import { contractContentHash, documentNumber, hashToken, isPublicToken, newPublicToken } from '@/lib/sales/documentTokens';

describe('estimate totals', () => {
  it('applies the discount before tax', () => {
    const t = estimateTotals([{ description: 'Counter', quantity: 2, unit: 'pcs', unit_price: 1500 }, { description: 'Shelving', quantity: 10, unit: 'm', unit_price: 120.5 }], 10, 8.25);
    expect(t.subtotal).toBe(4205);
    expect(t.discount).toBe(420.5);
    expect(t.tax).toBe(312.22);
    expect(t.total).toBe(4096.72);
  });

  it('is zero for no lines', () => {
    expect(estimateTotals([], 0, 0)).toEqual({ subtotal: 0, discount: 0, tax: 0, total: 0 });
  });
});

describe('estimate input', () => {
  it('drops empty rows and rounds money', () => {
    const r = parseEstimate({ title: 'Store fit-out', currency: 'USD', line_items: [{ description: 'Counter', quantity: '1', unit_price: '99.999' }, { description: '', quantity: '', unit_price: '' }] });
    expect('value' in r && r.value.line_items).toEqual([{ description: 'Counter', quantity: 1, unit: null, unit_price: 100 }]);
  });

  it('rejects bad lines, percentages and currencies', () => {
    expect(parseEstimate({ title: 'x', line_items: [{ description: '', quantity: 1, unit_price: 5 }] })).toEqual({ error: 'Line 1: add a description' });
    expect(parseEstimate({ title: 'x', line_items: [{ description: 'a', quantity: 0, unit_price: 5 }] })).toEqual({ error: 'Line 1: quantity must be more than 0' });
    expect(parseEstimate({ title: 'x', discount_pct: 120 })).toEqual({ error: 'Discount must be between 0 and 100 %' });
    expect(parseEstimate({ title: 'x', currency: 'BTC' })).toEqual({ error: 'Pick a currency' });
    expect(parseEstimate({ title: '' })).toEqual({ error: 'Give the estimate a title' });
  });
});

describe('contracts and links', () => {
  it('drafts terms from the estimate', () => {
    const terms = defaultContractTerms({ customer: 'Acme Retail', title: 'Store fit-out', estimateNumber: 'EST-202610-ABC123', amount: 4096.72, currency: 'USD' });
    expect(terms).toContain('Acme Retail');
    expect(terms).toContain('EST-202610-ABC123');
    expect(terms).toContain(formatMoney(4096.72, 'USD'));
  });

  it('freezes the signed text: any change to title, terms or amount changes the hash', () => {
    const base = { title: 'Fit-out', terms: 'Text', amount: 100, currency: 'USD' };
    const h = contractContentHash(base);
    expect(contractContentHash({ ...base })).toBe(h);
    expect(contractContentHash({ ...base, terms: 'Text.' })).not.toBe(h);
    expect(contractContentHash({ ...base, amount: 100.01 })).not.toBe(h);
  });

  it('numbers documents and makes unguessable links', () => {
    expect(documentNumber('EST', new Date('2026-10-28T10:00:00Z'))).toMatch(/^EST-202610-[0-9A-F]{6}$/);
    const t = newPublicToken();
    expect(isPublicToken(t)).toBe(true);
    expect(isPublicToken('short')).toBe(false);
    expect(hashToken(t)).toHaveLength(64);
    expect(newPublicToken()).not.toBe(t);
  });
});
