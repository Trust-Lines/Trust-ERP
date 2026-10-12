import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { imagesOfWorkbook } from '@/lib/marketing/import/images';
import { autoMapColumns, detectHeaderRow } from '@/lib/marketing/import/columns';
import { buildPeople } from '@/lib/marketing/import/records';
import { buildGroups } from '@/lib/marketing/import/group';
import { importPhotoFolder, importPhotoName } from '@/lib/marketing/import/photos';

// 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');

async function workbookWithPhotos(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('CRM Import');
  ws.addRow(['Name', 'Organization', 'Primary Contact', 'Email', 'WhatsApp Photo 1', 'WhatsApp Photo 2']);
  ws.addRow(['Acme', 'Acme', 'Jane Doe', 'jane@acme.com', '', '']);
  ws.addRow(['Kent', 'Kent oil', 'Adam Sturdivant', 'adam@kent.com', '', '']);
  ws.addRow([]); // blank row in between
  ws.addRow(['Zed', 'Zed Co', 'Zed Zed', 'zed@zed.com', '', '']);
  const id = wb.addImage({ buffer: PNG as never, extension: 'png' });
  ws.addImage(id, { tl: { col: 4, row: 2 }, ext: { width: 20, height: 20 } }); // Kent's row (index 2), column E
  ws.addImage(id, { tl: { col: 5, row: 2 }, ext: { width: 20, height: 20 } }); // same row, column F
  ws.addImage(id, { tl: { col: 4, row: 4 }, ext: { width: 20, height: 20 } }); // Zed's row (index 4, after a blank row)
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('pictures inside an Excel file', () => {
  it('are read with the row and column they sit on', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await workbookWithPhotos()) as never);
    const images = imagesOfWorkbook(wb, 'CRM Import');
    expect(images.map(i => [i.row, i.col, i.ext])).toEqual([[2, 4, 'png'], [2, 5, 'png'], [4, 4, 'png']]);
    expect(images[0].bytes.length).toBeGreaterThan(0);
    expect(imagesOfWorkbook(wb, 'No such sheet')).toEqual([]);
  });

  it('end up on the right person even with a blank row in the sheet (grid rows == file rows)', async () => {
    const buf = await workbookWithPhotos();
    const ewb = new ExcelJS.Workbook();
    await ewb.xlsx.load(buf as never);
    const images = imagesOfWorkbook(ewb, 'CRM Import');

    // the same way the browser reads the grid
    const sx = XLSX.read(buf, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sx.Sheets['CRM Import'], { header: 1, defval: '', raw: false, blankrows: true, range: 0 })
      .map(r => (r as unknown[]).map(c => String(c ?? '')));
    const header = detectHeaderRow(rows);
    const byRow = new Map<number, string[]>();
    for (const im of images) byRow.set(im.row, [...(byRow.get(im.row) ?? []), im.id]);

    const { people } = buildPeople(rows, header, autoMapColumns(rows[header], rows.slice(header + 1)), 'f', byRow);
    const photosOf = (name: string) => people.find(p => p.name === name)?.photos ?? [];
    expect(photosOf('Jane Doe')).toEqual([]);
    expect(photosOf('Adam Sturdivant')).toHaveLength(2); // two pictures on Kent's row
    expect(photosOf('Zed Zed')).toHaveLength(1);

    // the pictures stay with their person when rows are combined into Contacts
    const groups = buildGroups(people);
    expect(groups.find(g => g.company === 'Kent oil')!.people[0].photos).toHaveLength(2);
  });

  it('are named from their content and filed in the event folder (NACS 2026 shares the survey folder)', () => {
    expect(importPhotoName('abcdef0123456789', 'JPG')).toBe('import-abcdef0123.jpg');
    expect(importPhotoFolder('NACS 2026', 'Kent oil', '1234567890')).toBe('/Marketing/NACS26 Contacts/Kent oil - 12345678');
    expect(importPhotoFolder('NACS26', 'Kent oil', '1234567890')).toBe('/Marketing/NACS26 Contacts/Kent oil - 12345678');
    expect(importPhotoFolder('JCK 26', 'Gold Co', '99999999aa')).toBe('/Marketing/JCK 26 Contacts/Gold Co - 99999999');
  });
});
