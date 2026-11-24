// A4 sticker sheet for IT item labels: 3 columns × 8 rows = 24 labels of 63.5 × 33.9 mm — the common
// "24 per sheet" layout (Avery L7159 and compatible sheets). All sizes in millimetres.
export const LABEL_SHEET = {
  name: 'A4 · 24 labels (3 × 8) · 63.5 × 33.9 mm',
  pageWidth: 210,
  pageHeight: 297,
  cols: 3,
  rows: 8,
  labelWidth: 63.5,
  labelHeight: 33.9,
  /** Left edge of the first column / top edge of the first row. */
  marginLeft: 7.25,
  marginTop: 12.9,
  /** Distance from one label's left (top) edge to the next one's. */
  pitchX: 66,
  pitchY: 33.9,
  qrSize: 28.5,
} as const;

export const LABELS_PER_SHEET = LABEL_SHEET.cols * LABEL_SHEET.rows;

/** Where each of `count` labels goes when printing starts at cell `startAt` (0 = top-left, row by row). */
export function sheetSlots(count: number, startAt = 0): { page: number; row: number; col: number }[] {
  const start = Math.min(Math.max(0, Math.floor(startAt) || 0), LABELS_PER_SHEET - 1);
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const n = start + i;
    const inPage = n % LABELS_PER_SHEET;
    return { page: Math.floor(n / LABELS_PER_SHEET), row: Math.floor(inPage / LABEL_SHEET.cols), col: inPage % LABEL_SHEET.cols };
  });
}

/** Short code printed on the label: "IT-" + the last 6 characters of the item id. */
export function labelCode(url: string): string {
  const id = decodeURIComponent(url.split('/').filter(Boolean).pop() ?? '');
  return `IT-${id.replace(/-/g, '').slice(-6).toUpperCase()}`;
}

/** Number of sheets `count` labels need from cell `startAt`. */
export const sheetsNeeded = (count: number, startAt = 0) =>
  count <= 0 ? 0 : Math.floor((Math.min(Math.max(0, startAt), LABELS_PER_SHEET - 1) + count - 1) / LABELS_PER_SHEET) + 1;
