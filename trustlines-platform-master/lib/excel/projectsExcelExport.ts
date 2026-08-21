
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export type ColumnKey =
  | 'projectNo' | 'type' | 'pfCode' | 'vendor' | 'orderType'
  | 'poSignStatus' | 'pfSignStatus' | 'status'
  | 'std' | 'etd' | 'rtd' | 'rtr' | 'rdy' | 'ftd' | 'snd'
  | 'pfUsd' | 'pfTl' | 'invoice' | 'invoiceTl' | 'expensesUsd' | 'expensesTl'
  | 'paymentRule' | 'containerNo' | 'containerDate';

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  projectNo: 'Project No', type: 'Type', pfCode: 'PF Code', vendor: 'Vendor',
  orderType: 'Order Type', poSignStatus: 'PO Sign Status', pfSignStatus: 'PF Sign Status',
  status: 'Status', std: 'STD', etd: 'ETD', rtd: 'RTD', rtr: 'RTR', rdy: 'RDY',
  ftd: 'FTD', snd: 'SND', pfUsd: 'PF USD', pfTl: 'PF TL', invoice: 'INV/USD',
  invoiceTl: 'INV/TL', expensesUsd: 'EXPENSES / USD', expensesTl: 'EXPENSES / TL',
  paymentRule: 'Payment Rule', containerNo: 'Container No', containerDate: 'Container Date',
};

export const COLUMN_WIDTHS: Record<ColumnKey, number> = {
  projectNo: 110, type: 140, pfCode: 180, vendor: 220, orderType: 200,
  poSignStatus: 140, pfSignStatus: 140, status: 140,
  std: 140, etd: 140, rtd: 140, rtr: 140, rdy: 140, ftd: 140, snd: 140,
  pfUsd: 160, pfTl: 160, invoice: 160, invoiceTl: 160, expensesUsd: 160, expensesTl: 160,
  paymentRule: 180, containerNo: 140, containerDate: 140,
};

export const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = [
  'projectNo', 'type', 'pfCode', 'vendor', 'orderType',
  'poSignStatus', 'pfSignStatus', 'status',
  'std', 'etd', 'rtd', 'rtr', 'rdy', 'ftd', 'snd',
  'pfUsd', 'pfTl', 'invoice', 'invoiceTl',
  'paymentRule', 'containerNo', 'containerDate',
];

export const TYPE_ORDER = ['Millwork', 'Shelving', 'Ceiling', 'Image', 'Furniture', 'Decoration'];

export const BUCKET_LABELS: { bucket: string; label: string }[] = [
  { bucket: 'TLINES_NE', label: 'TLines NE' },
  { bucket: 'TLINES_SE', label: 'TLines SE' },
  { bucket: 'TLINES_NW', label: 'TLines NW' },
  { bucket: 'CVW', label: 'TLines CVW' },
  { bucket: 'TLINES_HQ', label: 'TLines HQ' },
  { bucket: 'TLINES_TC', label: 'TLines TC' },
];

export function mapType(value: string | null | undefined): string {
  if (!value) return '';
  const m: Record<string, string> = {
    MILLWORK: 'Millwork', SHELVING: 'Shelving', CEILING: 'Ceiling',
    IMAGE: 'Image', FURNITURE: 'Furniture', DECORATION: 'Decoration',
  };
  return m[value] || value;
}

export function mapStatus(value: string | null | undefined): string {
  if (!value) return '';
  const m: Record<string, string> = {
    HOLD_T: 'HOLD / T', HOLD_PM: 'HOLD / PM', NOT_ORDERED: 'NOT ORDERED',
    ORDERED: 'ORDERED', WAITING_PAYMENT: 'WAITING PAYMENT', ASSEMBLY: 'ASSEMBLY',
    READY_TO_RECEIVE: 'READY TO RECEIVE', RECEIVED: 'RECEIVED', READY: 'READY',
    SENT_TO_TLINES: 'SENT TO TLINES', PARTIAL_SENT: 'PARTIAL SENT', SENT: 'SENT',
  };
  return m[value] || value;
}

export function mapSignStatus(value: string | null | undefined): string {
  if (!value) return '';
  const m: Record<string, string> = {
    NOT_SIGNED: 'NOT SIGNED', READY_TO_SIGN: 'READY TO SIGN', SIGNED: 'SIGNED',
    SIGNED_NO_PRICE: 'SIGNED (NO PRICE)', SIGNED_WITH_PRICE: 'SIGNED (WITH PRICE)',
  };
  return m[value] || value;
}

export type ProjectColor = 'orange' | 'blue' | 'green' | 'red';

function projectColorArgb(color: ProjectColor): string {
  switch (color) {
    case 'orange': return 'DE8244';
    case 'blue':   return '6A99D1';
    case 'green':  return '9FCF63';
    case 'red':    return 'E53E3E';
    default:       return 'DE8244';
  }
}

const COLORS = {
  sectionHeader: { bg: 'B02417', fg: 'FFFFFF' },
  columnHeader:  { bg: '000000', fg: 'FFFFFF' },
  projectHeader: { bg: '404040', fg: 'FFFFFF' },
  projectTotal:  { bg: '404040', fg: 'FFFFFF' },
  sectionTotal:  { bg: '2563EB', fg: 'FFFFFF' },
  typeAllSent:   { bg: '15803D', fg: 'FFFFFF' },
};

function statusFill(status: string | null | undefined): { bg: string; fg: string } | null {
  if (!status) return null;
  const s = status.toString().toUpperCase().trim();
  switch (s) {
    case 'NOT ORDERED': case 'NOT_ORDERED':           return { bg: 'DC2626', fg: 'FFFFFF' };
    case 'ORDERED':                                    return { bg: '2563EB', fg: 'FFFFFF' };
    case 'WAITING PAYMENT': case 'WAITING_PAYMENT':    return { bg: 'A855F7', fg: 'FFFFFF' };
    case 'ASSEMBLY':                                   return { bg: 'FBBF24', fg: '000000' };
    case 'READY TO RECEIVE': case 'READY_TO_RECEIVE':  return { bg: 'F97316', fg: 'FFFFFF' };
    case 'RECEIVED':                                   return { bg: 'FB923C', fg: '000000' };
    case 'READY':                                      return { bg: '86EFAC', fg: '000000' };
    case 'SENT TO TLINES': case 'SENT_TO_TLINES': case 'SENT': return { bg: '15803D', fg: 'FFFFFF' };
    case 'NOT SIGNED': case 'NOT_SIGNED':              return { bg: 'FF0000', fg: '000000' };
    case 'READY TO SIGN': case 'READY_TO_SIGN':        return { bg: 'FFFF00', fg: '000000' };
    case 'SIGNED':                                     return { bg: '92D050', fg: '000000' };
    default: return null;
  }
}

function signStatusFill(value: string): { bg: string; fg: string } | null {
  if (value === 'SIGNED') return { bg: '92D050', fg: '000000' };
  if (value === 'READY TO SIGN') return { bg: 'FFFF00', fg: '000000' };
  if (value === 'NOT SIGNED') return { bg: 'FF0000', fg: '000000' };
  return null;
}

const BORDER_THIN: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'D1D5DB' } };
const BORDERS_ALL: Partial<ExcelJS.Borders> = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN };
const CENTER: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center' };
function fillBg(argb: string): ExcelJS.Fill { return { type: 'pattern', pattern: 'solid', fgColor: { argb } }; }

export function toNumber(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function parseDate(value: any): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const DATE_COLS: ColumnKey[] = ['std', 'etd', 'rtd', 'rtr', 'rdy', 'ftd', 'snd', 'containerDate'];
const USD_COLS: ColumnKey[] = ['pfUsd', 'invoice', 'expensesUsd'];
const TL_COLS: ColumnKey[] = ['pfTl', 'invoiceTl', 'expensesTl'];
const isDateCol = (c: ColumnKey) => DATE_COLS.includes(c);
const isUsdCol = (c: ColumnKey) => USD_COLS.includes(c);
const isTlCol = (c: ColumnKey) => TL_COLS.includes(c);
const isMoneyCol = (c: ColumnKey) => isUsdCol(c) || isTlCol(c);

export interface PItem {
  type?: string | null;
  pfCode?: string | null;
  vendor?: string | { code?: string | null; name?: string | null } | null;
  vendorId?: string | null;
  orderType?: string | null;
  poSignStatus?: string | null;
  pfSignStatus?: string | null;
  status?: string | null;
  std?: string | null; etd?: string | null; rtd?: string | null; rtr?: string | null;
  rdy?: string | null; ftd?: string | null; snd?: string | null;
  pfUsd?: number | string | null;  pfTl?: number | string | null;
  invoice?: number | string | null; invoiceTl?: number | string | null;
  expensesUsd?: number | string | null; expensesTl?: number | string | null;
  paymentRule?: string | null;
  containerNo?: string | null;
  containerDate?: string | null;
}

export interface PProject {
  projectNo: string | number;
  projectName?: string;
  color?: ProjectColor;
  isUrgent?: boolean;
  containerDate?: string | null;
  bucket?: string;
  items: PItem[];
}

export interface PSection {
  label: string;
  projects: PProject[];
}

export function computeProjectColor(project: PProject): ProjectColor {
  if (project.color) return project.color;
  const items = project.items || [];

  const norm = (s: any) => String(s ?? '').trim().toUpperCase().replace(/[\s-]/g, '_');
  const allSent = items.length > 0 && items.every(i => norm(i.status) === 'SENT');
  if (allSent) return 'green';

  let minDays: number | null = null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (const i of items) {
    const cd = i.containerDate || project.containerDate;
    if (!cd) continue;
    const d = new Date(cd); if (isNaN(d.getTime())) continue;
    d.setHours(0, 0, 0, 0);
    const days = Math.ceil((d.getTime() - today.getTime()) / 86400000);
    if (minDays === null || days < minDays) minDays = days;
  }
  if (project.isUrgent || (minDays !== null && minDays <= 10 && minDays >= 0)) return 'red';

  const hasPoSigned = items.some(i => {
    const p = norm(i.poSignStatus);
    return p === 'SIGNED' || p === 'READY_TO_SIGN';
  });
  if (hasPoSigned) return 'blue';

  return 'orange';
}

export function buildSectionsFromProjects(projects: PProject[]): PSection[] {
  const byBucket: Record<string, PProject[]> = {};
  for (const p of projects) {
    const b = p.bucket || 'OTHER';
    (byBucket[b] ||= []).push(p);
  }
  const ordered = BUCKET_LABELS
    .filter(r => byBucket[r.bucket]?.length)
    .map(r => ({ label: r.label, projects: byBucket[r.bucket] }));
  const extras = Object.keys(byBucket)
    .filter(b => !BUCKET_LABELS.some(r => r.bucket === b))
    .sort()
    .map(b => ({ label: b, projects: byBucket[b] }));
  return [...ordered, ...extras];
}

export function vendorText(v: PItem['vendor']): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return v.code ? `${v.code} - ${v.name ?? ''}` : (v.name ?? '');
}

export function effUsd(i: PItem): number { const inv = toNumber(i.invoice); return inv > 0 ? inv : toNumber(i.pfUsd); }
export function effTl(i: PItem): number { const inv = toNumber(i.invoiceTl); return inv > 0 ? inv : toNumber(i.pfTl); }

export function groupItemsByType(items: PItem[]): { type: string; items: PItem[] }[] {
  const map = new Map<string, PItem[]>();
  for (const it of items) {
    const t = mapType(it.type) || 'Unknown';
    (map.get(t) ?? map.set(t, []).get(t)!).push(it);
  }
  const known = TYPE_ORDER.filter(t => map.has(t)).map(t => ({ type: t, items: map.get(t)! }));
  const custom = [...map.keys()].filter(t => !TYPE_ORDER.includes(t)).sort().map(t => ({ type: t, items: map.get(t)! }));
  return [...known, ...custom];
}

export function writeProjectsSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  sections: PSection[],
  visibleColumns: ColumnKey[] = DEFAULT_VISIBLE_COLUMNS,
): void {
  const cols = visibleColumns;
  if (cols.length === 0) return;

  const colCount = cols.length;
  const projNoIdx = cols.indexOf('projectNo');
  const typeIdx = cols.indexOf('type');
  const poSignIdx = cols.indexOf('poSignStatus');
  const pfUsdIdx = cols.indexOf('pfUsd');
  const totalLabelIdx = pfUsdIdx > 0 ? pfUsdIdx - 1 : 0;

  const ws = wb.addWorksheet(sheetName.substring(0, 31), {
    views: [{ state: 'frozen', ySplit: 0, xSplit: 0 }],
  });
  ws.columns = cols.map(c => ({ width: Math.round(COLUMN_WIDTHS[c] / 7.5) }));

  const setMoney = (cell: ExcelJS.Cell, col: ColumnKey, n: number) => {
    cell.value = n !== 0 ? n : null;
    cell.numFmt = isUsdCol(col) ? '$#,##0.00' : '₺#,##0.00';
    cell.alignment = CENTER;
  };

  for (const section of sections) {
    if (!section.projects.length) continue;

    const secRow = ws.addRow([section.label]);
    ws.mergeCells(secRow.number, 1, secRow.number, colCount);
    const secCell = secRow.getCell(1);
    secCell.font = { bold: true, size: 14, color: { argb: COLORS.sectionHeader.fg } };
    secCell.fill = fillBg(COLORS.sectionHeader.bg);
    secCell.alignment = CENTER;
    secRow.height = 28;

    let secUsd = 0, secTl = 0, secInv = 0, secInvTl = 0;

    for (const project of section.projects) {
      const projColor = projectColorArgb(computeProjectColor(project));

      const projRow = ws.addRow([`${project.projectNo} - ${project.projectName ?? ''}`]);
      ws.mergeCells(projRow.number, 1, projRow.number, colCount);
      const pc = projRow.getCell(1);
      pc.font = { bold: true, size: 11, color: { argb: COLORS.projectHeader.fg } };
      pc.fill = fillBg(COLORS.projectHeader.bg);
      pc.alignment = CENTER;
      projRow.height = 24;

      const hdrRow = ws.addRow(cols.map(c => COLUMN_LABELS[c]));
      hdrRow.height = 22;
      hdrRow.eachCell(cell => {
        cell.font = { bold: true, size: 10, color: { argb: COLORS.columnHeader.fg } };
        cell.fill = fillBg(COLORS.columnHeader.bg);
        cell.alignment = { ...CENTER, wrapText: true };
        cell.border = BORDERS_ALL;
      });

      const firstDataRow = ws.lastRow!.number + 1;
      let projUsd = 0, projTl = 0, projInv = 0, projInvTl = 0;

      for (const group of groupItemsByType(project.items || [])) {
        const groupStart = ws.lastRow!.number + 1;

        const allSent = group.items.length > 0 && group.items.every(it => {
          const s = String(it.status || '').toUpperCase().replace(/[\s-]/g, '_');
          return s === 'SENT_TO_TLINES' || s === 'SENT';
        });

        const groupPo = (() => {
          const list = group.items.map(it => mapSignStatus(it.poSignStatus).toUpperCase()).filter(s => s);
          if (!list.length) return '';
          if (list.length === group.items.length && list.every(s => s === 'SIGNED')) return 'SIGNED';
          if (list.some(s => s === 'READY TO SIGN')) return 'READY TO SIGN';
          return 'NOT SIGNED';
        })();

        for (const item of group.items) {
          const row = ws.addRow(cols.map(() => ''));
          row.height = 18;

          row.eachCell({ includeEmpty: true }, (cell, n) => {
            const col = cols[n - 1];
            cell.font = { size: 10 };
            cell.border = BORDERS_ALL;
            cell.alignment = CENTER;

            if (col === 'projectNo' || col === 'type' || col === 'poSignStatus') return;
            if (col === 'vendor') { cell.value = vendorText(item.vendor); return; }
            if (col === 'pfSignStatus') { cell.value = mapSignStatus(item.pfSignStatus); }
            else if (col === 'status') { cell.value = mapStatus(item.status); }
            else if (isMoneyCol(col)) { setMoney(cell, col, toNumber((item as any)[col])); cell.font = { size: 10 }; cell.border = BORDERS_ALL; }
            else if (isDateCol(col)) { cell.value = parseDate((item as any)[col]) ?? ''; cell.numFmt = 'dd/mm/yyyy'; }
            else cell.value = (item as any)[col] ?? '';

            if (col === 'status' || col === 'pfSignStatus') {
              const f = statusFill(col === 'status' ? item.status : item.pfSignStatus);
              if (f) { cell.fill = fillBg(f.bg); cell.font = { size: 10, bold: true, color: { argb: f.fg } }; }
            }
          });

          projUsd += toNumber(item.pfUsd);
          projTl += toNumber(item.pfTl);
          projInv += toNumber(item.invoice);
          projInvTl += toNumber(item.invoiceTl);
          secUsd += effUsd(item);
          secTl += effTl(item);
          secInv += toNumber(item.invoice);
          secInvTl += toNumber(item.invoiceTl);
        }

        const groupEnd = ws.lastRow!.number;

        if (typeIdx >= 0 && group.items.length) {
          const c = typeIdx + 1;
          if (groupEnd > groupStart) ws.mergeCells(groupStart, c, groupEnd, c);
          const cell = ws.getCell(groupStart, c);
          cell.value = group.type;
          cell.alignment = CENTER;
          cell.border = BORDERS_ALL;
          if (allSent) { cell.fill = fillBg(COLORS.typeAllSent.bg); cell.font = { size: 10, bold: true, color: { argb: COLORS.typeAllSent.fg } }; }
          else cell.font = { size: 10, bold: true };
        }

        if (poSignIdx >= 0 && group.items.length) {
          const c = poSignIdx + 1;
          if (groupEnd > groupStart) ws.mergeCells(groupStart, c, groupEnd, c);
          const cell = ws.getCell(groupStart, c);
          cell.value = groupPo;
          cell.alignment = CENTER;
          cell.border = BORDERS_ALL;
          const f = signStatusFill(groupPo);
          if (f) { cell.fill = fillBg(f.bg); cell.font = { size: 10, bold: true, color: { argb: f.fg } }; }
          else cell.font = { size: 10 };
        }
      }

      const ptRow = ws.addRow(cols.map(() => ''));
      ptRow.height = 20;
      ptRow.eachCell({ includeEmpty: true }, (cell, n) => {
        const col = cols[n - 1];
        cell.font = { bold: true, size: 10, color: { argb: COLORS.projectTotal.fg } };
        cell.fill = fillBg(COLORS.projectTotal.bg);
        cell.border = BORDERS_ALL;
        cell.alignment = CENTER;
        if (n - 1 === totalLabelIdx) cell.value = 'TOTAL';
        else if (col === 'pfUsd') setMoney(cell, col, projUsd);
        else if (col === 'pfTl') setMoney(cell, col, projTl);
        else if (col === 'invoice') setMoney(cell, col, projInv);
        else if (col === 'invoiceTl') setMoney(cell, col, projInvTl);
        if (isMoneyCol(col)) { cell.font = { bold: true, size: 10, color: { argb: COLORS.projectTotal.fg } }; cell.fill = fillBg(COLORS.projectTotal.bg); cell.border = BORDERS_ALL; }
      });

      if (projNoIdx >= 0 && (project.items?.length ?? 0) > 0) {
        const c = projNoIdx + 1;
        if (ptRow.number > firstDataRow) ws.mergeCells(firstDataRow, c, ptRow.number, c);
        const cell = ws.getCell(firstDataRow, c);
        cell.value = String(project.projectNo);
        cell.font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
        cell.fill = fillBg(projColor);
        cell.alignment = CENTER;
        cell.border = BORDERS_ALL;
      }
    }

    const stRow = ws.addRow(cols.map(() => ''));
    stRow.height = 24;
    stRow.eachCell({ includeEmpty: true }, (cell, n) => {
      const col = cols[n - 1];
      cell.font = { bold: true, size: 12, color: { argb: COLORS.sectionTotal.fg } };
      cell.fill = fillBg(COLORS.sectionTotal.bg);
      cell.border = BORDERS_ALL;
      cell.alignment = CENTER;
      if (col === 'pfUsd') setMoney(cell, col, secUsd);
      else if (col === 'pfTl') setMoney(cell, col, secTl);
      else if (col === 'invoice') setMoney(cell, col, secInv);
      else if (col === 'invoiceTl') setMoney(cell, col, secInvTl);
      if (isMoneyCol(col)) { cell.font = { bold: true, size: 12, color: { argb: COLORS.sectionTotal.fg } }; cell.fill = fillBg(COLORS.sectionTotal.bg); cell.border = BORDERS_ALL; }
    });
    const labelEnd = pfUsdIdx > 1 ? pfUsdIdx : 1;
    if (labelEnd > 1) ws.mergeCells(stRow.number, 1, stRow.number, labelEnd);
    const stLabel = ws.getCell(stRow.number, 1);
    stLabel.value = `${section.label.toUpperCase()} TOTALS`;
    stLabel.alignment = CENTER;

    ws.addRow([]);
  }
}

export interface PMoney { usd: number; tl: number; }
export interface PCategoryRows { projects: PMoney; directOrder: PMoney; missingExtra: PMoney; trustExpenses?: PMoney; }
export interface PCompanyTotals { companyKey: string; label: string; production: PCategoryRows; expenses: PCategoryRows; }

const PT_COMPANIES = [
  { key: 'TLINES_NE', label: 'T LINES NE', bucket: 'TLINES_NE' },
  { key: 'TLINES_SE', label: 'T LINES SE', bucket: 'TLINES_SE' },
  { key: 'TLINES_CVW', label: 'T LINES CVW', bucket: 'CVW' },
  { key: 'TLINES_NW', label: 'T LINES NW', bucket: 'TLINES_NW' },
  { key: 'TLINES_HQ', label: 'T LINES HQ', bucket: 'TLINES_HQ' },
  { key: 'TRUST_TC', label: 'TRUST TC', bucket: 'TLINES_TC' },
];

function ptEmptyRows(): PCategoryRows {
  return { projects: { usd: 0, tl: 0 }, directOrder: { usd: 0, tl: 0 }, missingExtra: { usd: 0, tl: 0 }, trustExpenses: { usd: 0, tl: 0 } };
}
function ptSum(r: PCategoryRows): PMoney {
  return {
    usd: r.projects.usd + r.directOrder.usd + r.missingExtra.usd + (r.trustExpenses?.usd || 0),
    tl: r.projects.tl + r.directOrder.tl + r.missingExtra.tl + (r.trustExpenses?.tl || 0),
  };
}
function ptAddMoney(a: PMoney, b: PMoney): PMoney { return { usd: a.usd + b.usd, tl: a.tl + b.tl }; }
function ptAddRows(a: PCategoryRows, b: PCategoryRows): PCategoryRows {
  return {
    projects: ptAddMoney(a.projects, b.projects),
    directOrder: ptAddMoney(a.directOrder, b.directOrder),
    missingExtra: ptAddMoney(a.missingExtra, b.missingExtra),
    trustExpenses: ptAddMoney(a.trustExpenses || { usd: 0, tl: 0 }, b.trustExpenses || { usd: 0, tl: 0 }),
  };
}

export function buildProjectTotalFromSections(opts: {
  projects: PSection[];
  missingExtra: PSection[];
  directOrders: PSection[];
}): PCompanyTotals[] {
  const sumByBucket = (sections: PSection[]): Record<string, PMoney> => {
    const out: Record<string, PMoney> = {};
    for (const section of sections) {
      for (const project of section.projects) {
        const bucket = project.bucket || '';
        out[bucket] ||= { usd: 0, tl: 0 };
        for (const it of project.items || []) {
          out[bucket].usd += effUsd(it);
          out[bucket].tl += effTl(it);
        }
      }
    }
    return out;
  };

  const pMap = sumByBucket(opts.projects);
  const doMap = sumByBucket(opts.directOrders);
  const meMap = sumByBucket(opts.missingExtra);

  return PT_COMPANIES.map(c => ({
    companyKey: c.key,
    label: c.label,
    production: {
      projects: pMap[c.bucket] || { usd: 0, tl: 0 },
      directOrder: doMap[c.bucket] || { usd: 0, tl: 0 },
      missingExtra: meMap[c.bucket] || { usd: 0, tl: 0 },
    },
    expenses: ptEmptyRows(),
  }));
}

export function writeProjectTotalSheet(wb: ExcelJS.Workbook, data: PCompanyTotals[], usdTryRate: number): void {
  const ws = wb.addWorksheet('Project Total');
  const L = { label: 1, usd: 2, tl: 3, all: 4, rate: 5 };
  const R = { label: 7, usd: 8, tl: 9, all: 10, rate: 11 };
  const GAP = 6;
  const PF_HEADER = '4472C4', EXP_HEADER = '92400E', COL_HEADER = '374151';
  const COMPANY = '4B5563', TOTAL = '1E293B', GRAND_SUB = '166534', GRAND = '0F172A', GRAND_FINAL = '111827';

  for (const s of [L, R]) {
    ws.getColumn(s.label).width = 22; ws.getColumn(s.usd).width = 16;
    ws.getColumn(s.tl).width = 16; ws.getColumn(s.all).width = 16; ws.getColumn(s.rate).width = 10;
  }
  ws.getColumn(GAP).width = 3;

  let row = 1;
  const rate = usdTryRate > 0 ? usdTryRate : 0;
  const calcAll = (m: PMoney) => (rate > 0 ? m.usd + m.tl / rate : 0);
  const numOrNull = (v: number) => (v === 0 ? null : v);

  const sc = (r: number, c: number, value: any, o: { bg?: string; fg?: string; bold?: boolean; align?: 'left' | 'center' | 'right'; numFmt?: string; size?: number } = {}) => {
    const cell = ws.getRow(r).getCell(c);
    cell.value = value;
    if (o.bg) cell.fill = fillBg(o.bg);
    cell.font = { bold: o.bold || false, color: o.fg ? { argb: o.fg } : undefined, size: o.size || 10 };
    cell.alignment = { horizontal: o.align || 'center', vertical: 'middle' };
    cell.border = BORDERS_ALL;
    if (o.numFmt) cell.numFmt = o.numFmt;
  };

  ws.mergeCells(row, L.label, row, L.rate);
  sc(row, L.label, 'PRODUCTION PRICE', { bg: PF_HEADER, fg: 'FFFFFF', bold: true, size: 11 });
  ws.mergeCells(row, R.label, row, R.rate);
  sc(row, R.label, 'EXPENSES', { bg: EXP_HEADER, fg: 'FFFFFF', bold: true, size: 11 });
  ws.getRow(row).height = 24; row++;

  const colHdr = (s: typeof L, labels: [string, string]) => {
    sc(row, s.label, '', { bg: COL_HEADER });
    sc(row, s.usd, labels[0], { bg: COL_HEADER, fg: 'FFFFFF', bold: true });
    sc(row, s.tl, labels[1], { bg: COL_HEADER, fg: 'FFFFFF', bold: true });
    sc(row, s.all, 'ALL', { bg: COL_HEADER, fg: 'FFFFFF', bold: true });
    sc(row, s.rate, '', { bg: COL_HEADER });
  };
  colHdr(L, ['PF / USD', 'PF / TL']); colHdr(R, ['Exp / USD', 'Exp / TL']);
  ws.getRow(row).height = 20; row++;

  const companyHeader = (label: string, s: typeof L) => {
    ws.mergeCells(row, s.label, row, s.rate);
    sc(row, s.label, label, { bg: COMPANY, fg: 'FFFFFF', bold: true, align: 'left', size: 11 });
  };
  const moneyRow = (s: typeof L, label: string, m: PMoney | undefined, o: { bg: string; fg?: string; bold?: boolean }) => {
    sc(row, s.label, label, { ...o, align: 'left' });
    if (m) {
      sc(row, s.usd, numOrNull(m.usd), { ...o, align: 'right', numFmt: '$#,##0.00' });
      sc(row, s.tl, numOrNull(m.tl), { ...o, align: 'right', numFmt: '₺#,##0.00' });
      sc(row, s.all, numOrNull(calcAll(m)), { ...o, align: 'right', numFmt: '$#,##0.00' });
    } else {
      sc(row, s.usd, '-', { ...o, align: 'right' }); sc(row, s.tl, '-', { ...o, align: 'right' }); sc(row, s.all, '-', { ...o, align: 'right' });
    }
    sc(row, s.rate, null, { bg: o.bg });
  };

  const prod = data.filter(d => PT_COMPANIES.some(c => c.key === d.companyKey));
  for (const pc of prod) {
    ws.getRow(row).height = 22;
    companyHeader(pc.label, L); companyHeader(pc.label, R); row++;
    const cats: (keyof PCategoryRows)[] = ['projects', 'directOrder', 'missingExtra', 'trustExpenses'];
    const labels = ['  Projects', '  Direct Order', '  Missing & Extra', '  Trust Expenses'];
    for (let i = 0; i < cats.length; i++) {
      ws.getRow(row).height = 18;
      moneyRow(L, labels[i], pc.production[cats[i]], { bg: 'FFFFFF' });
      moneyRow(R, labels[i], pc.expenses[cats[i]], { bg: 'FFFFFF' });
      row++;
    }
    ws.getRow(row).height = 18;
    moneyRow(L, '  TOTAL', ptSum(pc.production), { bg: TOTAL, fg: 'FFFFFF', bold: true });
    moneyRow(R, '  TOTAL', ptSum(pc.expenses), { bg: TOTAL, fg: 'FFFFFF', bold: true });
    row++;
  }

  const prodGrand = prod.reduce<PCategoryRows>((a, c) => ptAddRows(a, c.production), ptEmptyRows());
  const expGrand = prod.reduce<PCategoryRows>((a, c) => ptAddRows(a, c.expenses), ptEmptyRows());
  const grandCats: { label: string; key: keyof PCategoryRows }[] = [
    { label: '  Projects', key: 'projects' }, { label: '  Direct Order', key: 'directOrder' },
    { label: '  Missing & Extra', key: 'missingExtra' }, { label: '  Trust Expenses', key: 'trustExpenses' },
  ];
  for (const gc of grandCats) {
    ws.getRow(row).height = 18;
    moneyRow(L, gc.label, prodGrand[gc.key], { bg: GRAND_SUB, fg: 'FFFFFF', bold: true });
    moneyRow(R, gc.label, expGrand[gc.key], { bg: GRAND_SUB, fg: 'FFFFFF', bold: true });
    row++;
  }
  ws.getRow(row).height = 18;
  moneyRow(L, '  TOTAL', ptSum(prodGrand), { bg: GRAND, fg: 'FFFFFF', bold: true });
  moneyRow(R, '  TOTAL', ptSum(expGrand), { bg: GRAND, fg: 'FFFFFF', bold: true });
  row++;

  const totalDolar = (s: typeof L, gt: PMoney) => {
    const td = rate > 0 ? gt.usd + gt.tl / rate : 0;
    sc(row, s.label, '  TOTAL DOLAR', { bg: GRAND, fg: 'FFFFFF', bold: true, align: 'left' });
    sc(row, s.usd, numOrNull(td), { bg: GRAND, fg: 'FFFFFF', bold: true, align: 'right', numFmt: '$#,##0.00' });
    sc(row, s.tl, null, { bg: GRAND }); sc(row, s.all, null, { bg: GRAND }); sc(row, s.rate, null, { bg: GRAND });
  };
  ws.getRow(row).height = 18; totalDolar(L, ptSum(prodGrand)); totalDolar(R, ptSum(expGrand)); row++;

  const grandFinal = (s: typeof L, gt: PMoney) => {
    const td = rate > 0 ? gt.usd + gt.tl / rate : 0;
    sc(row, s.label, 'GRAND TOTAL DOLAR', { bg: GRAND_FINAL, fg: 'FFFFFF', bold: true, align: 'left', size: 11 });
    sc(row, s.usd, numOrNull(td), { bg: GRAND_FINAL, fg: 'FFFFFF', bold: true, align: 'right', numFmt: '$#,##0.00' });
    sc(row, s.tl, null, { bg: GRAND_FINAL }); sc(row, s.all, null, { bg: GRAND_FINAL });
    sc(row, s.rate, rate > 0 ? rate : null, { bg: GRAND_FINAL, fg: 'FDE68A', bold: true });
  };
  ws.getRow(row).height = 24; grandFinal(L, ptSum(prodGrand)); grandFinal(R, ptSum(expGrand)); row++;
}

export interface ExportProjectsOptions {
  projects: PSection[];
  missingExtra?: PSection[];
  directOrders?: PSection[];
  projectTotalRate?: number;
  projectTotal?: PCompanyTotals[];
  visibleColumns?: ColumnKey[];
  isColumnVisible?: (key: ColumnKey) => boolean;
  filename?: string;
}

export async function exportProjectsWorkbook(opts: ExportProjectsOptions): Promise<void> {
  const cols = (opts.visibleColumns ?? DEFAULT_VISIBLE_COLUMNS)
    .filter(c => (opts.isColumnVisible ? opts.isColumnVisible(c) : true));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Projects Export';
  wb.created = new Date();

  writeProjectsSheet(wb, 'Projects', opts.projects, cols);
  if (opts.missingExtra) writeProjectsSheet(wb, 'Missing & Extra', opts.missingExtra, cols);
  if (opts.directOrders) writeProjectsSheet(wb, 'Direct Orders', opts.directOrders, cols);

  const ptData = opts.projectTotal ?? buildProjectTotalFromSections({
    projects: opts.projects,
    missingExtra: opts.missingExtra ?? [],
    directOrders: opts.directOrders ?? [],
  });
  writeProjectTotalSheet(wb, ptData, opts.projectTotalRate ?? 41.23);

  const dateStr = new Date().toISOString().slice(0, 10);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, opts.filename || `Projects_${dateStr}.xlsx`);
}

export const BOARD_CSS = {
  sectionHeader: { bg: '#B02417', fg: '#FFFFFF' },
  columnHeader:  { bg: '#000000', fg: '#FFFFFF' },
  projectHeader: { bg: '#404040', fg: '#FFFFFF' },
  projectTotal:  { bg: '#404040', fg: '#FFFFFF' },
  sectionTotal:  { bg: '#2563EB', fg: '#FFFFFF' },
  typeAllSent:   { bg: '#15803D', fg: '#FFFFFF' },
  border:        '#D1D5DB',
};

export function projectColorCss(color: ProjectColor): string {
  return `#${projectColorArgb(color)}`;
}

export function statusCellCss(status: string | null | undefined): { bg: string; fg: string } | null {
  const f = statusFill(status);
  return f ? { bg: `#${f.bg}`, fg: `#${f.fg}` } : null;
}

export function signStatusCellCss(value: string | null | undefined): { bg: string; fg: string } | null {
  const f = signStatusFill(String(value ?? '').toUpperCase());
  return f ? { bg: `#${f.bg}`, fg: `#${f.fg}` } : null;
}

export function groupPoSignStatus(items: PItem[]): string {
  const list = items.map(it => mapSignStatus(it.poSignStatus).toUpperCase()).filter(s => s);
  if (!list.length) return '';
  if (list.length === items.length && list.every(s => s === 'SIGNED')) return 'SIGNED';
  if (list.some(s => s === 'READY TO SIGN')) return 'READY TO SIGN';
  return 'NOT SIGNED';
}

export function groupAllSent(items: PItem[]): boolean {
  return items.length > 0 && items.every(it => {
    const s = String(it.status || '').toUpperCase().replace(/[\s-]/g, '_');
    return s === 'SENT_TO_TLINES' || s === 'SENT';
  });
}

export function fmtMoneyCss(col: ColumnKey, n: number): string {
  if (n === 0) return '';
  const sym = isUsdCol(col) ? '$' : '₺';
  return `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDateCss(value: any): string {
  const d = parseDate(value);
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export const isDateColumn = isDateCol;
export const isMoneyColumn = isMoneyCol;
export const isUsdColumn = isUsdCol;
