import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildBackupWorkbook, type BackupData } from '@/lib/marketing/contactBackup';

describe('Contacts backup workbook', () => {
  const data: BackupData = {
    generatedAt: '2026-10-09T03:00:00.000Z',
    scope: 'all',
    tables: {
      Contacts: [
        { id: 'p1', display_name: 'Kent oil', business_types: ['C-stores'], created_at: '2026-10-07T10:00:00Z' },
        { id: 'p2', display_name: 'Acme', x_note: 'x'.repeat(40000) },
      ],
      People: [{ id: 'c1', prospect_id: 'p1', name: 'Adam', whatsapp: true }],
      Notes: [],
    },
  };

  it('has a summary and one sheet per table, with every column that appears in any row', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildBackupWorkbook(data)) as never);
    expect(wb.worksheets.map(w => w.name)).toEqual(['Summary', 'Contacts', 'People', 'Notes']);
    const contacts = wb.getWorksheet('Contacts')!;
    expect(contacts.getRow(1).values).toEqual([undefined, 'id', 'display_name', 'business_types', 'created_at', 'x_note']);
    expect(contacts.getRow(2).getCell(3).value).toBe('["C-stores"]'); // arrays keep their content as JSON
    expect(wb.getWorksheet('People')!.getRow(2).getCell(4).value).toBe(true);
    expect(wb.getWorksheet('Summary')!.getRow(4).values).toEqual([undefined, 'Contacts', 2]);
  });

  it('never exceeds Excel\'s cell limit and says so when it cuts', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildBackupWorkbook(data)) as never);
    const long = String(wb.getWorksheet('Contacts')!.getRow(3).getCell(5).value);
    expect(long.length).toBeLessThanOrEqual(32000);
    expect(long.endsWith('…')).toBe(true);
    // the JSON next to it is not cut — nothing is lost
    expect(JSON.stringify(data).includes('x'.repeat(40000))).toBe(true);
  });

  it('an empty table still gets a (marked) sheet', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildBackupWorkbook(data)) as never);
    expect(wb.getWorksheet('Notes')!.getRow(1).getCell(1).value).toBe('(empty)');
  });
});
