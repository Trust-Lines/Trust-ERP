import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { regionLabel } from '@/lib/regions';

// Flat, single-sheet "every field the card has" export — used by both Contacts' and Contact
// Manager's "Export to Excel" (app/api/marketing/prospects/route.ts's export=1&detail=1,
// 2026-09-28). Deliberately not the mail-merge CSV the template-picker export makes (that
// one's built for a template, name+email only); this one is for handing a full data pull to
// someone, so every scalar/joined field the row already carries goes in — project name/number
// included, if the Contact has one.

export interface ContactExportRow {
  id?: string;
  /** Dropbox paths of the pictures on the Contact's Activity (the API caps these per Contact). */
  photos?: string[];
  display_name: string;
  entity_type?: string | null;
  organization_name?: string | null;
  person_name?: string | null;
  brand_name?: string | null;
  industry?: string | null;
  status?: string | null;
  source_label?: string | null;
  source_raw_label?: string | null;
  region?: string | null;
  state?: string | null;
  main_email?: string | null;
  main_phone?: string | null;
  project_code?: string | null;
  project_name?: string | null;
  whatsapp?: boolean;
  primary_contact?: string | null;
  business_types?: string[] | null;
  tags?: { name: string }[] | null;
  project_types?: string[] | null;
  scope_types?: string[] | null;
  timing?: string | null;
  owner_name?: string | null;
  next_action?: string | null;
  next_action_date?: string | null;
  target_contact_date?: string | null;
  potential_count?: number;
  opportunity_count?: number;
  completeness_percent?: number;
  is_archived?: boolean;
  effective_created_at?: string | null;
  created_at?: string;
  updated_at?: string;
  // "[date] Author: note text" lines, one per prospect_contact_notes entry, newest last —
  // already combined into one string server-side (app/api/marketing/prospects/route.ts's
  // export=1&detail=1) since an Excel cell is what this is for: one cell per Contact, not a
  // second sheet or a row explosion (2026-09-28, "içeriği tek hücrede olsun").
  activities?: string;
  /** The Contact's X-note — what the team (and the fair survey's "Notes") wrote on the card. */
  x_note?: string | null;
  /** "Created by" on the card: who took the fair survey (Layal, Justin, T, Naim, Merve, Hashem). */
  created_by_label?: string | null;
}

const COLUMNS: { header: string; width: number; get: (r: ContactExportRow) => string | number }[] = [
  { header: 'Name', width: 26, get: r => r.display_name ?? '' },
  { header: 'Type', width: 12, get: r => r.entity_type ?? '' },
  { header: 'Organization', width: 24, get: r => r.organization_name ?? '' },
  { header: 'Person', width: 20, get: r => r.person_name ?? '' },
  { header: 'Brand', width: 18, get: r => r.brand_name ?? '' },
  { header: 'Industry', width: 18, get: r => r.industry ?? '' },
  { header: 'Status', width: 16, get: r => r.status ?? '' },
  { header: 'Source', width: 18, get: r => r.source_raw_label || r.source_label || '' },
  { header: 'Region', width: 20, get: r => (r.region ? regionLabel(r.region) : '') },
  { header: 'State', width: 10, get: r => r.state ?? '' },
  { header: 'Email', width: 26, get: r => r.main_email ?? '' },
  { header: 'Phone', width: 16, get: r => r.main_phone ?? '' },
  { header: 'Project #', width: 14, get: r => r.project_code ?? '' },
  { header: 'Project Name', width: 24, get: r => r.project_name ?? '' },
  { header: 'WhatsApp', width: 10, get: r => (r.whatsapp ? 'Yes' : 'No') },
  { header: 'Primary Contact', width: 20, get: r => r.primary_contact ?? '' },
  { header: 'Business Types', width: 24, get: r => (r.business_types ?? []).join(', ') },
  { header: 'Tags', width: 20, get: r => (r.tags ?? []).map(t => t.name).join(', ') },
  { header: 'Project Types', width: 22, get: r => (r.project_types ?? []).join(', ') },
  { header: 'Scope Types', width: 22, get: r => (r.scope_types ?? []).join(', ') },
  { header: 'Timing', width: 16, get: r => r.timing ?? '' },
  { header: 'Assignee', width: 18, get: r => r.owner_name ?? '' },
  { header: 'Next Action', width: 24, get: r => r.next_action ?? '' },
  { header: 'Next Action Date', width: 16, get: r => r.next_action_date ?? '' },
  { header: 'Target Contact Date', width: 16, get: r => r.target_contact_date ?? '' },
  { header: 'Potentials', width: 10, get: r => r.potential_count ?? 0 },
  { header: 'Opportunities', width: 12, get: r => r.opportunity_count ?? 0 },
  { header: 'Info %', width: 9, get: r => r.completeness_percent ?? 0 },
  { header: 'Archived', width: 10, get: r => (r.is_archived ? 'Yes' : 'No') },
  { header: 'Added', width: 14, get: r => fmtDate(r.effective_created_at ?? r.created_at) },
  { header: 'Updated', width: 14, get: r => fmtDate(r.updated_at) },
  { header: 'Created by', width: 16, get: r => r.created_by_label ?? '' },
  { header: 'Notes', width: 42, get: r => r.x_note ?? '' },
  { header: 'Activities', width: 60, get: r => r.activities ?? '' },
];

const ACTIVITIES_COL = COLUMNS.findIndex(c => c.header === 'Activities') + 1; // 1-based, exceljs convention
const NOTES_COL = COLUMNS.findIndex(c => c.header === 'Notes') + 1;
const NOTES_CHARS_PER_LINE = 44; // a Notes line wraps at about this many characters (column width 42)

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

const BORDER_THIN: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'D1D5DB' } };
const BORDERS_ALL: Partial<ExcelJS.Borders> = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN };
function fillBg(argb: string): ExcelJS.Fill { return { type: 'pattern', pattern: 'solid', fgColor: { argb } }; }

// ── Pictures ──────────────────────────────────────────────────────────────────────────────
// A picture cannot live INSIDE a text cell in Excel, so each Contact's Activity photos go into "Photo 1…N"
// cells right after the Activities text, and the row grows to fit them — text and pictures side by side.
export interface ExportPhoto { base64: string; width: number; height: number }
export const photoKey = (prospectId: string, path: string) => `${prospectId}|${path}`;

const PHOTO_BOX = { width: 168, height: 126 }; // px, on screen in Excel
const PX_TO_PT = 0.75;
const MAX_ROW_PT = 400; // Excel's limit is 409

const fit = (w: number, h: number) => {
  const k = Math.min(PHOTO_BOX.width / w, PHOTO_BOX.height / h, 1);
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
};

/** The workbook, with whatever pictures are in `photos` (key: photoKey(id, path)). Pure — no network, no download. */
export function buildContactsWorkbook(rows: ContactExportRow[], photos: Map<string, ExportPhoto> = new Map()): ExcelJS.Workbook {
  const available = (r: ContactExportRow) => (r.photos ?? []).filter(p => r.id && photos.has(photoKey(r.id, p)));
  const photoColumns = rows.reduce((n, r) => Math.max(n, available(r).length), 0);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Trust-Lines Contact Manager';
  wb.created = new Date();
  const ws = wb.addWorksheet('Contacts', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = [
    ...COLUMNS.map(c => ({ header: c.header, width: c.width })),
    ...Array.from({ length: photoColumns }, (_, i) => ({ header: `Photo ${i + 1}`, width: 25 })),
  ];

  const headerRow = ws.getRow(1);
  headerRow.eachCell(cell => {
    cell.font = { bold: true, size: 10.5, color: { argb: 'FFFFFF' } };
    cell.fill = fillBg('1F2937');
    cell.border = BORDERS_ALL;
    cell.alignment = { vertical: 'middle' };
  });
  headerRow.height = 20;

  rows.forEach((r, i) => {
    const row = ws.addRow(COLUMNS.map(c => c.get(r)));
    row.eachCell((cell, colNumber) => {
      const isActivities = colNumber === ACTIVITIES_COL || colNumber === NOTES_COL; // the two long-text columns
      cell.font = { size: 10 };
      cell.border = BORDERS_ALL;
      cell.alignment = { vertical: isActivities ? 'top' : 'middle', wrapText: isActivities };
    });
    if (i % 2 === 1) row.eachCell(cell => { cell.fill = fillBg('F9FAFB'); });

    // Activities can be several lines — give the row enough height to actually show them
    // instead of clipping to the default single line (Excel doesn't auto-size row height for
    // wrapped text on its own when the file is opened).
    const noteLines = (r.x_note ?? '').split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / NOTES_CHARS_PER_LINE)), 0);
    const lineCount = Math.max((r.activities ?? '').split('\n').filter(Boolean).length, (r.x_note ?? '') ? noteLines : 0);
    let height = lineCount > 1 ? Math.min(15 * lineCount, 300) : 0;

    // Pictures: one per Photo cell, the row at least as tall as the tallest one.
    let tallest = 0;
    available(r).forEach((path, k) => {
      const photo = photos.get(photoKey(r.id as string, path))!;
      const size = fit(photo.width, photo.height);
      const imageId = wb.addImage({ base64: photo.base64, extension: 'jpeg' });
      ws.addImage(imageId, { tl: { col: COLUMNS.length + k + 0.05, row: row.number - 1 + 0.05 }, ext: size, editAs: 'oneCell' });
      tallest = Math.max(tallest, size.height);
    });
    if (tallest) height = Math.max(height, Math.round(tallest * PX_TO_PT) + 8);
    if (height) row.height = Math.min(height, MAX_ROW_PT);
  });

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length + photoColumns } };
  return wb;
}

const PHOTO_BATCH = 20;
const PHOTO_LIMIT = 400; // total pictures per export — keeps the file and the wait reasonable

async function measure(base64: string): Promise<{ width: number; height: number }> {
  try {
    const blob = await (await fetch(`data:image/jpeg;base64,${base64}`)).blob();
    const bitmap = await createImageBitmap(blob);
    return { width: bitmap.width, height: bitmap.height };
  } catch {
    return { width: 480, height: 320 }; // Dropbox's thumbnail box
  }
}

/** Downloads small previews of the Contacts' pictures (in batches). Never throws: a failure just means fewer pictures. */
async function loadPhotos(rows: ContactExportRow[], onProgress?: (message: string) => void): Promise<Map<string, ExportPhoto>> {
  const wanted: { prospectId: string; path: string }[] = [];
  for (const r of rows) for (const path of r.photos ?? []) if (r.id) wanted.push({ prospectId: r.id, path });
  const photos = new Map<string, ExportPhoto>();
  const items = wanted.slice(0, PHOTO_LIMIT);
  for (let i = 0; i < items.length; i += PHOTO_BATCH) {
    onProgress?.(`Getting photos ${Math.min(i + PHOTO_BATCH, items.length)} / ${items.length}…`);
    try {
      const res = await fetch('/api/marketing/prospects/photos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: items.slice(i, i + PHOTO_BATCH) }) });
      if (!res.ok) continue;
      const body = await res.json() as { photos?: Record<string, string | null> };
      for (const it of items.slice(i, i + PHOTO_BATCH)) {
        const base64 = body.photos?.[it.path];
        if (base64) photos.set(photoKey(it.prospectId, it.path), { base64, ...(await measure(base64)) });
      }
    } catch { /* keep going — the Excel still gets the text */ }
  }
  return photos;
}

export async function exportContactsWorkbook(
  rows: ContactExportRow[], filename?: string, opts: { onProgress?: (message: string) => void } = {},
): Promise<{ photos: number; photosWanted: number }> {
  const photosWanted = rows.reduce((n, r) => n + (r.photos?.length ?? 0), 0);
  const photos = photosWanted ? await loadPhotos(rows, opts.onProgress) : new Map<string, ExportPhoto>();
  opts.onProgress?.('Building the Excel file…');
  const wb = buildContactsWorkbook(rows, photos);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const dateStr = new Date().toISOString().slice(0, 10);
  saveAs(blob, filename || `Contacts_${dateStr}.xlsx`);
  return { photos: photos.size, photosWanted };
}
