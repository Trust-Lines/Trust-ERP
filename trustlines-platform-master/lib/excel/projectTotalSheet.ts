import type ExcelJS from 'exceljs';
import { effTl, effUsd, type PSection } from '@/lib/production/boardModel';
import { BORDERS_ALL, fillBg } from './excelStyles';

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

const ZERO = (): PMoney => ({ usd: 0, tl: 0 });

function ptEmptyRows(): PCategoryRows {
  return { projects: ZERO(), directOrder: ZERO(), missingExtra: ZERO(), trustExpenses: ZERO() };
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
    trustExpenses: ptAddMoney(a.trustExpenses || ZERO(), b.trustExpenses || ZERO()),
  };
}

/** Production totals per company from the three board tabs. Expenses are left at zero. */
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
        out[bucket] ||= ZERO();
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
      projects: pMap[c.bucket] || ZERO(),
      directOrder: doMap[c.bucket] || ZERO(),
      missingExtra: meMap[c.bucket] || ZERO(),
    },
    expenses: ptEmptyRows(),
  }));
}

/**
 * "Project Total" sheet: PRODUCTION PRICE (left) and EXPENSES (right) side by side, per company,
 * then grand totals. "ALL" / "TOTAL DOLAR" convert TL at `usdTryRate` (blank when the rate is 0).
 */
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

  const sc = (r: number, c: number, value: ExcelJS.CellValue, o: { bg?: string; fg?: string; bold?: boolean; align?: 'left' | 'center' | 'right'; numFmt?: string; size?: number } = {}) => {
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

  const cats: { label: string; key: keyof PCategoryRows }[] = [
    { label: '  Projects', key: 'projects' }, { label: '  Direct Order', key: 'directOrder' },
    { label: '  Missing & Extra', key: 'missingExtra' }, { label: '  Trust Expenses', key: 'trustExpenses' },
  ];

  const prod = data.filter(d => PT_COMPANIES.some(c => c.key === d.companyKey));
  for (const pc of prod) {
    ws.getRow(row).height = 22;
    companyHeader(pc.label, L); companyHeader(pc.label, R); row++;
    for (const cat of cats) {
      ws.getRow(row).height = 18;
      moneyRow(L, cat.label, pc.production[cat.key], { bg: 'FFFFFF' });
      moneyRow(R, cat.label, pc.expenses[cat.key], { bg: 'FFFFFF' });
      row++;
    }
    ws.getRow(row).height = 18;
    moneyRow(L, '  TOTAL', ptSum(pc.production), { bg: TOTAL, fg: 'FFFFFF', bold: true });
    moneyRow(R, '  TOTAL', ptSum(pc.expenses), { bg: TOTAL, fg: 'FFFFFF', bold: true });
    row++;
  }

  const prodGrand = prod.reduce<PCategoryRows>((a, c) => ptAddRows(a, c.production), ptEmptyRows());
  const expGrand = prod.reduce<PCategoryRows>((a, c) => ptAddRows(a, c.expenses), ptEmptyRows());
  for (const cat of cats) {
    ws.getRow(row).height = 18;
    moneyRow(L, cat.label, prodGrand[cat.key], { bg: GRAND_SUB, fg: 'FFFFFF', bold: true });
    moneyRow(R, cat.label, expGrand[cat.key], { bg: GRAND_SUB, fg: 'FFFFFF', bold: true });
    row++;
  }
  ws.getRow(row).height = 18;
  moneyRow(L, '  TOTAL', ptSum(prodGrand), { bg: GRAND, fg: 'FFFFFF', bold: true });
  moneyRow(R, '  TOTAL', ptSum(expGrand), { bg: GRAND, fg: 'FFFFFF', bold: true });
  row++;

  const totalDolar = (s: typeof L, gt: PMoney) => {
    sc(row, s.label, '  TOTAL DOLAR', { bg: GRAND, fg: 'FFFFFF', bold: true, align: 'left' });
    sc(row, s.usd, numOrNull(calcAll(gt)), { bg: GRAND, fg: 'FFFFFF', bold: true, align: 'right', numFmt: '$#,##0.00' });
    sc(row, s.tl, null, { bg: GRAND }); sc(row, s.all, null, { bg: GRAND }); sc(row, s.rate, null, { bg: GRAND });
  };
  ws.getRow(row).height = 18; totalDolar(L, ptSum(prodGrand)); totalDolar(R, ptSum(expGrand)); row++;

  const grandFinal = (s: typeof L, gt: PMoney) => {
    sc(row, s.label, 'GRAND TOTAL DOLAR', { bg: GRAND_FINAL, fg: 'FFFFFF', bold: true, align: 'left', size: 11 });
    sc(row, s.usd, numOrNull(calcAll(gt)), { bg: GRAND_FINAL, fg: 'FFFFFF', bold: true, align: 'right', numFmt: '$#,##0.00' });
    sc(row, s.tl, null, { bg: GRAND_FINAL }); sc(row, s.all, null, { bg: GRAND_FINAL });
    sc(row, s.rate, rate > 0 ? rate : null, { bg: GRAND_FINAL, fg: 'FDE68A', bold: true });
  };
  ws.getRow(row).height = 24; grandFinal(L, ptSum(prodGrand)); grandFinal(R, ptSum(expGrand)); row++;
}
