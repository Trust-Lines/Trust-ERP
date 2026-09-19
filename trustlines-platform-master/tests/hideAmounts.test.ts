import { describe, it, expect } from 'vitest';
import { maskAmounts, AMOUNT_MASK } from '@/lib/privacy/hideAmounts';

describe('maskAmounts', () => {
  it.each([
    ['$24.7M', `$${AMOUNT_MASK}`],
    ['$1,200 due', `$${AMOUNT_MASK} due`],
    ['$342K', `$${AMOUNT_MASK}`],
    ['€2,500.50', `€${AMOUNT_MASK}`],
    ['USD 1,000 total', `USD ${AMOUNT_MASK} total`],
    ['Deal size $11.43M and $0.23M', `Deal size $${AMOUNT_MASK} and $${AMOUNT_MASK}`],
    ['-$1,200', `-$${AMOUNT_MASK}`],
    ['Deposit 30% of $10,000', `Deposit 30% of $${AMOUNT_MASK}`],
    ['$1,200/mo', `$${AMOUNT_MASK}/mo`],
  ])('masks %s', (input, expected) => {
    expect(maskAmounts(input)).toBe(expected);
  });

  it.each([
    'Project 1157 – 4600 Broad St', '2026-09-19', 'Section 12, item 3', '30% deposit', 'Store Maker', '112',
  ])('leaves %s alone', input => {
    expect(maskAmounts(input)).toBe(input);
  });

  it('is idempotent (re-masking an already masked string changes nothing)', () => {
    const once = maskAmounts('Pipeline $2.3M');
    expect(maskAmounts(once)).toBe(once);
  });
});
