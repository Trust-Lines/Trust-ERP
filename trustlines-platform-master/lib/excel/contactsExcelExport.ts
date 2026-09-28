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
];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

const BORDER_THIN: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'D1D5DB' } };
const BORDERS_ALL: Partial<ExcelJS.Borders> = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN };
function fillBg(argb: string): ExcelJS.Fill { return { type: 'pattern', pattern: 'solid', fgColor: { argb } }; }

export async function exportContactsWorkbook(rows: ContactExportRow[], filename?: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Trust-Lines Contact Manager';
  wb.created = new Date();
  const ws = wb.addWorksheet('Contacts', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = COLUMNS.map(c => ({ header: c.header, width: c.width }));

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
    row.eachCell(cell => {
      cell.font = { size: 10 };
      cell.border = BORDERS_ALL;
      cell.alignment = { vertical: 'middle', wrapText: false };
    });
    if (i % 2 === 1) row.eachCell(cell => { cell.fill = fillBg('F9FAFB'); });
  });

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const dateStr = new Date().toISOString().slice(0, 10);
  saveAs(blob, filename || `Contacts_${dateStr}.xlsx`);
}
