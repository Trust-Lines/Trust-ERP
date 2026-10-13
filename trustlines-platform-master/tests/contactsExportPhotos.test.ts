import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildContactsWorkbook, photoKey, type ContactExportRow, type ExportPhoto } from '@/lib/excel/contactsExcelExport';
import { imagesOfWorkbook } from '@/lib/marketing/import/images';

// 1x1 PNG is fine as bytes; what matters is where it is placed
const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const photo = (width: number, height: number): ExportPhoto => ({ base64: PIXEL, width, height });

const rows: ContactExportRow[] = [
  { id: 'p1', display_name: 'Kent oil', activities: '[2026-10-08] Survey: Photo added at NACS 2026.', photos: ['/a/1.jpg', '/a/2.jpg'] },
  { id: 'p2', display_name: 'No pictures', activities: 'one line' },
  { id: 'p3', display_name: 'Tall one', activities: 'x', photos: ['/b/1.jpg'] },
];

async function roundTrip(photos: Map<string, ExportPhoto>) {
  const wb = buildContactsWorkbook(rows, photos);
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load((await wb.xlsx.writeBuffer()) as never);
  return loaded;
}

describe('Export to Excel with pictures', () => {
  const photos = new Map<string, ExportPhoto>([
    [photoKey('p1', '/a/1.jpg'), photo(480, 320)],
    [photoKey('p1', '/a/2.jpg'), photo(240, 320)],
    [photoKey('p3', '/b/1.jpg'), photo(320, 480)],
  ]);

  it('adds Photo 1…N columns after Activities and keeps the text', async () => {
    const wb = await roundTrip(photos);
    const ws = wb.getWorksheet('Contacts')!;
    const header = ws.getRow(1).values as unknown[];
    expect(header.slice(-2)).toEqual(['Photo 1', 'Photo 2']);
    expect(header[header.length - 3]).toBe('Activities');
    expect(String(ws.getRow(2).getCell(header.length - 3).value)).toContain('Photo added at NACS 2026');
  });

  it('puts each picture in the right row and Photo column', async () => {
    const wb = await roundTrip(photos);
    const found = imagesOfWorkbook(wb, 'Contacts').map(i => [i.row, i.col]);
    const firstPhotoCol = (wb.getWorksheet('Contacts')!.getRow(1).values as unknown[]).indexOf('Photo 1') - 1; // 0-based
    expect(found).toEqual([[1, firstPhotoCol], [1, firstPhotoCol + 1], [3, firstPhotoCol]]);
  });

  it('makes the row tall enough for its tallest picture (and leaves picture-less rows alone)', async () => {
    const ws = (await roundTrip(photos)).getWorksheet('Contacts')!;
    // portrait 320x480 is scaled into the 168x126 box → 84x126 px = 94.5pt (+ padding)
    expect(ws.getRow(4).height).toBeGreaterThanOrEqual(95);
    expect(ws.getRow(3).height ?? 15).toBeLessThan(40);
  });

  it('is still a normal text export when no picture could be loaded', async () => {
    const ws = (await roundTrip(new Map())).getWorksheet('Contacts')!;
    expect((ws.getRow(1).values as unknown[]).some(v => typeof v === 'string' && v.startsWith('Photo'))).toBe(false);
    expect(imagesOfWorkbook(ws.workbook, 'Contacts')).toEqual([]);
  });
});

describe('Export to Excel — Notes (X-note)', () => {
  const noted: ContactExportRow[] = [
    { id: 'n1', display_name: 'Fair lead', x_note: 'Wants a quote before June\nCall Justin', activities: 'one line' },
    { id: 'n2', display_name: 'No note' },
  ];

  it('has a Notes column with each Contact\'s X-note, right before Activities', async () => {
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load((await buildContactsWorkbook(noted).xlsx.writeBuffer()) as never);
    const ws = loaded.getWorksheet('Contacts')!;
    const header = ws.getRow(1).values as unknown[];
    const notes = header.indexOf('Notes');
    expect(notes).toBeGreaterThan(0);
    expect(header[notes + 1]).toBe('Activities');
    expect(ws.getRow(2).getCell(notes).value).toBe('Wants a quote before June\nCall Justin');
    expect(ws.getRow(3).getCell(notes).value ?? '').toBe('');
    expect(ws.getRow(2).getCell(notes).alignment?.wrapText).toBe(true);
  });

  it('makes the row tall enough for a long note', async () => {
    const long: ContactExportRow[] = [{ id: 'n3', display_name: 'Long', x_note: 'word '.repeat(80) }];
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load((await buildContactsWorkbook(long).xlsx.writeBuffer()) as never);
    expect(loaded.getWorksheet('Contacts')!.getRow(2).height).toBeGreaterThan(60);
  });
});
