// Pictures placed inside an .xlsx (a photo "in" a cell, e.g. the "WhatsApp Photo 1…4" columns) are not
// cell values — they are drawings anchored to a cell. This reads them out together with the row/column
// they sit on, so the importer can attach each picture to the right person.
//
// Works with any ExcelJS workbook that has been loaded (browser or Node). Legacy .xls files have no
// reader for this; pictures are only taken from .xlsx.

export interface SheetImage {
  /** Unique within the sheet. */
  id: string;
  /** 0-based row index in the sheet grid (same indexing as the rows the importer reads). */
  row: number;
  col: number;
  /** jpg | png | gif | webp (lower-case, no dot) */
  ext: string;
  bytes: Uint8Array;
}

const ALLOWED = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
export const MAX_SHEET_IMAGE_BYTES = 15 * 1024 * 1024;

export function imagesOfWorkbook(wb: any, sheetName: string): SheetImage[] {
  const ws = wb.getWorksheet(sheetName);
  if (!ws || typeof ws.getImages !== 'function') return [];
  const out: SheetImage[] = [];
  for (const im of ws.getImages() as any[]) {
    const tl = im?.range?.tl;
    if (!tl) continue;
    const row = Math.floor(Number(tl.nativeRow ?? tl.row ?? 0));
    const col = Math.floor(Number(tl.nativeCol ?? tl.col ?? 0));
    const media = wb.getImage(Number(im.imageId));
    const ext = String(media?.extension ?? '').toLowerCase().replace('jpeg', 'jpg');
    if (!media?.buffer || !ALLOWED.has(ext)) continue;
    const bytes = new Uint8Array(media.buffer);
    if (!bytes.length || bytes.length > MAX_SHEET_IMAGE_BYTES) continue;
    out.push({ id: `${sheetName}#${out.length}`, row, col, ext, bytes });
  }
  return out;
}
