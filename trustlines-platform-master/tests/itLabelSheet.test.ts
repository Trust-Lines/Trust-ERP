import { describe, expect, it } from 'vitest';
import { LABEL_SHEET, LABELS_PER_SHEET, labelCode, sheetSlots, sheetsNeeded } from '@/components/platform/it/labelSheet';

describe('A4 label sheet', () => {
  it('fits 3 × 8 labels on A4', () => {
    const S = LABEL_SHEET;
    expect(LABELS_PER_SHEET).toBe(24);
    expect(S.marginLeft * 2 + (S.cols - 1) * S.pitchX + S.labelWidth).toBeCloseTo(S.pageWidth, 1);
    expect(S.marginTop * 2 + (S.rows - 1) * S.pitchY + S.labelHeight).toBeCloseTo(S.pageHeight, 1);
  });

  it('places labels row by row from the start cell, onto further sheets', () => {
    expect(sheetSlots(1)).toEqual([{ page: 0, row: 0, col: 0 }]);
    expect(sheetSlots(2, 4)).toEqual([{ page: 0, row: 1, col: 1 }, { page: 0, row: 1, col: 2 }]);
    expect(sheetSlots(2, 23)).toEqual([{ page: 0, row: 7, col: 2 }, { page: 1, row: 0, col: 0 }]);
    expect(sheetSlots(1, 99)[0]).toEqual({ page: 0, row: 7, col: 2 });
  });

  it('counts sheets', () => {
    expect(sheetsNeeded(0)).toBe(0);
    expect(sheetsNeeded(24)).toBe(1);
    expect(sheetsNeeded(25)).toBe(2);
    expect(sheetsNeeded(2, 23)).toBe(2);
  });

  it('makes the short code from the item id', () => {
    expect(labelCode('https://x.test/it/items/0b9e7c1a-1111-2222-3333-44445f9a2c3d')).toBe('IT-9A2C3D');
  });
});
