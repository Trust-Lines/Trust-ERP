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

describe('Trust Stock helpers', () => {
  it('reads D / W / H from a description', async () => {
    const { dimsFromText } = await import('@/components/platform/trust-stock/store');
    expect(dimsFromText('CABINET WITH UPPER PAINTED U PROFILE INTERFACE AND LAMINATED FORMICA DOOR ( D=32.5"-W=40"-H=32.75")'))
      .toEqual({ depth: '32.5"', width: '40"', height: '32.75"' });
    expect(dimsFromText('CABINET WITH CLADDING FORMICA SHELF. (D=12"- W=48"- H=36,75")')).toEqual({ depth: '12"', width: '48"', height: '36.75"' });
    expect(dimsFromText('32" WOOD SHELF DEPTH 15"')).toEqual({ depth: '', width: '', height: '' });
  });
  it('does not double the word STOCK', async () => {
    const { stockTile } = await import('@/components/platform/trust-stock/store');
    expect(stockTile('STOCK-TR-04')).toEqual({ head: 'STOCK', rest: 'TR-04' });
    expect(stockTile('TR-04')).toEqual({ head: 'STOCK', rest: 'TR-04' });
    expect(stockTile('STOCK 2')).toEqual({ head: 'STOCK', rest: '2' });
  });
});
