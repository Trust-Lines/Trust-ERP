// Browser-only. Reads .xlsx / .xls / .csv into plain string grids, one per sheet. Parsing happens
// in the user's browser (the file never has to fit through a serverless request, and the legacy
// .xls format is handled by SheetJS, loaded only when an import is actually started).
export interface SheetData {
  name: string;
  rows: string[][];
}

export const MAX_IMPORT_FILE_BYTES = 25 * 1024 * 1024;
const MAX_ROWS_PER_SHEET = 20_000;

export async function readSpreadsheet(file: File): Promise<SheetData[]> {
  if (file.size > MAX_IMPORT_FILE_BYTES) throw new Error(`"${file.name}" is larger than 25 MB.`);
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const sheets: SheetData[] = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '', raw: false, blankrows: false });
    if (rows.length > MAX_ROWS_PER_SHEET) throw new Error(`Sheet "${name}" has more than ${MAX_ROWS_PER_SHEET.toLocaleString()} rows — split the file first.`);
    sheets.push({ name, rows: rows.map(r => (r as unknown[]).map(c => String(c ?? ''))) });
  }
  if (!sheets.some(s => s.rows.length > 1)) throw new Error(`"${file.name}" has no data rows.`);
  return sheets;
}
