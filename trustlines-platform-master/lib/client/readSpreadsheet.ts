import type { SheetImage } from '@/lib/marketing/import/images';
import { imagesOfWorkbook } from '@/lib/marketing/import/images';

// Browser-only. Reads .xlsx / .xls / .csv into plain string grids, one per sheet. Parsing happens
// in the user's browser (the file never has to fit through a serverless request, and the legacy
// .xls format is handled by SheetJS, loaded only when an import is actually started).
// For .xlsx the pictures placed in cells are read as well (ExcelJS), each with the row it sits on.
export interface SheetData {
  name: string;
  /** Every row of the sheet, blank ones included, so row numbers match the pictures' anchors. */
  rows: string[][];
  images: SheetImage[];
}

export const MAX_IMPORT_FILE_BYTES = 25 * 1024 * 1024;
const MAX_ROWS_PER_SHEET = 20_000;

export async function readSpreadsheet(file: File): Promise<SheetData[]> {
  if (file.size > MAX_IMPORT_FILE_BYTES) throw new Error(`"${file.name}" is larger than 25 MB.`);
  const buffer = await file.arrayBuffer();
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  // Pictures are a bonus: a file that cannot be read for pictures still imports its text.
  let imagesBySheet = new Map<string, SheetImage[]>();
  if (/\.xlsx$/i.test(file.name)) {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const ewb = new ExcelJS.Workbook();
      await ewb.xlsx.load(buffer as never);
      imagesBySheet = new Map(wb.SheetNames.map(n => [n, imagesOfWorkbook(ewb, n)]));
    } catch (e) {
      console.warn('[import] pictures could not be read:', e instanceof Error ? e.message : e);
    }
  }

  const sheets: SheetData[] = [];
  for (const name of wb.SheetNames) {
    // range: 0 + blankrows keep the grid's row numbers identical to the file's (picture anchors depend on it)
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '', raw: false, blankrows: true, range: 0 });
    if (rows.length > MAX_ROWS_PER_SHEET) throw new Error(`Sheet "${name}" has more than ${MAX_ROWS_PER_SHEET.toLocaleString()} rows — split the file first.`);
    sheets.push({ name, rows: rows.map(r => (r as unknown[]).map(c => String(c ?? ''))), images: imagesBySheet.get(name) ?? [] });
  }
  if (!sheets.some(s => s.rows.length > 1)) throw new Error(`"${file.name}" has no data rows.`);
  return sheets;
}
