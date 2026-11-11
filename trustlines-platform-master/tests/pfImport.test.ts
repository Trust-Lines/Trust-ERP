import { describe, expect, it } from 'vitest';
import { cleanProducts, currencySymbol, rowBox } from '@/components/platform/trust-stock/pfImport';

describe('rowBox', () => {
  it('turns PDF points (origin bottom-left) into a box from the top of the drawn page', () => {
    // A4-ish page 842 pt tall drawn at 0.5 px/pt, 300 px wide.
    const b = rowBox({ itemCode: 'X', page: 0, x0: 331, x1: 378, y0: 513.76, y1: 541.76 }, 842, 0.5, 300);
    expect(b.top).toBeCloseTo((842 - 541.76) * 0.5);
    expect(b.height).toBeCloseTo(14);
    expect(b.left).toBeCloseTo(9);
    expect(b.width).toBeCloseTo(282);
  });
});

describe('cleanProducts', () => {
  it('sends only the fields the import accepts', () => {
    const out = cleanProducts([{ itemCode: ' 32" SHELF ', description: 'd', category: null, quantity: 12, unitPrice: 13, totalPrice: 156, extra: 1 } as never]);
    expect(out).toEqual([{ itemCode: '32" SHELF', description: 'd', category: null, quantity: 12, unitPrice: 13, totalPrice: 156 }]);
  });
  it('symbols', () => { expect(currencySymbol('TL')).toBe('₺'); expect(currencySymbol('EUR')).toBe('€'); expect(currencySymbol('USD')).toBe('$'); });
});
