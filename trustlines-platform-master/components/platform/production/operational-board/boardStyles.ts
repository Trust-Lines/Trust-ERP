import {
  DEFAULT_VISIBLE_COLUMNS,
  computeProjectColor, vendorText, toNumber, fmtDateCss, isDateColumn, isMoneyColumn,
  type PItem, type ColumnKey,
} from '@/lib/excel/projectsExcelExport';
import type { ProductionAccess } from '@/lib/production/access';

// Figma "Production Board" (node 384:51717) orders RTR before RTD; the Excel export keeps its own order.
export const COLS: ColumnKey[] = DEFAULT_VISIBLE_COLUMNS.map(c => (c === 'rtd' ? 'rtr' : c === 'rtr' ? 'rtd' : c));
export const LABELS: Partial<Record<ColumnKey, string>> = {
  projectNo: 'Project #', poSignStatus: 'PO Status', pfUsd: 'PF/USD', pfTl: 'PF/TL', containerNo: 'Container#',
};
export const WIDTHS: Partial<Record<ColumnKey, number>> = {
  projectNo: 118, type: 94, pfCode: 125, vendor: 231, orderType: 117, poSignStatus: 124, pfSignStatus: 124, status: 135,
  rdy: 102, snd: 124, pfUsd: 100, pfTl: 103, invoice: 101, invoiceTl: 117, paymentRule: 116,
};
export const MONEY_COLS: ColumnKey[] = ['pfUsd', 'pfTl', 'invoice', 'invoiceTl'];
export const NO_ACCESS: ProductionAccess = {
  tabProjects: false, tabMissingExtra: false, tabDirectOrders: false, viewMoney: false, export: false, editStatus: false,
  editRows: false, deleteRows: false, editProjects: false, deleteProjects: false, todo: false, groups: false, half: false,
  viewPf: false,
};
// Figma "Projects table" (TRUST-LINES ERP 728:13023, colours 728:14366 / 14370 / 14374 / 14378): a
// project's header row, its Project # box and its TOTAL row take the project's colour as a tone —
// the colour rule is unchanged, only the tones are new (globals.css tokens, light + dark):
//   default (was orange) → New Status 02 grey (#C0C0C0 / #2B2B2B, Figma 728:14366 as updated) · PO signed / ready → T2 blue
//   every row SENT → New Status 10 green  · urgent / container ≤ 10 days → T10 red
export const PROJECT_TONE: Record<ReturnType<typeof computeProjectColor>, string> = { orange: 'n2', blue: 't2', green: 'n10', red: 't10' };
// Region bands (Figma 741:17517 / 17523 / 17528 / 17533): one colour per region, light text, a
// chevron that folds the region's projects away. HQ / TC have no design yet and use the NE colour.
const REGION_BG: Record<string, string> = { NE: '#465B6D', SE: '#3B472B', NW: '#2E5BA3', CVW: '#7A655E' };
export function regionBg(label: string): string {
  const words = label.toUpperCase().split(/\s+/);
  const k = Object.keys(REGION_BG).find(r => words.includes(r));
  return k ? REGION_BG[k] : REGION_BG.NE;
}
/** A PF group's band is a red gradient instead of a region colour. */
export const bandBg = (section: { label: string; group?: unknown }) =>
  section.group != null ? 'linear-gradient(90deg, #b91c1c, #ef4444)' : regionBg(section.label);
export const regionTitle = (label: string) => label.replace(/^TLines(?=\s)/i, 'T Lines');
export const toneBg = (t: string) => `var(--status-${t}-bg)`;
export const toneFg = (t: string) => `var(--status-${t}-fg)`;

// Every cell has a right border: vertical lines between all columns, like a spreadsheet.
export const TD = 'overflow-hidden text-ellipsis whitespace-nowrap border-b border-r border-ui-divider bg-ui-page-bg px-2 py-2.5 text-left align-middle text-[12px] text-ui-body';
// Trust System behaviour: the column header and region bands stay on top while scrolling down,
// Project # and Type stay on the left while scrolling sideways, and the board scrolls inside a box
// that fits the window, so its horizontal scrollbar is always on screen.
export const HEAD_H = 46;
export const TYPE_TEXT = 'text-[14px] font-semibold text-[var(--color-secondary-700)] dark:text-ui-heading';
// The frozen left block: Project # and Type. Every full-width row (region band, project band,
// TOTAL) is split so its left part stays there too, and the rest of the table runs beside it.
export const FROZEN = 2;
export const FROZEN_TD = 'sticky left-0 z-10 overflow-hidden';

export function money(col: ColumnKey, n: number): string {
  const sym = col === 'pfUsd' || col === 'invoice' ? '$' : '₺';
  return `${sym} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function shortDate(value: unknown): string {
  const [d, m, y] = fmtDateCss(value).split('/');
  return y ? `${Number(m)}/${Number(d)}/${y}` : '';
}

export function cellValue(col: ColumnKey, item: PItem): React.ReactNode {
  if (col === 'vendor')   return vendorText(item.vendor);
  // An empty amount stays empty (only TOTAL rows write 0.00), as in the Trust System.
  if (isMoneyColumn(col)) { const n = toNumber((item as Record<string, unknown>)[col] as number); return n ? money(col, n) : ''; }
  if (isDateColumn(col))  return shortDate((item as Record<string, unknown>)[col]);
  const v = (item as Record<string, unknown>)[col];
  return v == null ? '' : String(v);
}

// Row order inside a type group (Trust System): YSM, then GOS, then the other vendors in the order
// they first appear, vendor-less rows last; within a vendor by PF number, then as created.
function vendorCodeOf(it: PItem): string {
  const v = it.vendor;
  return (typeof v === 'string' ? v.split(' - ')[0] : v?.code ?? '').toUpperCase();
}
export function sortForDisplay(items: PItem[]): PItem[] {
  const first = new Map<string, number>();
  items.forEach((it, i) => { const c = vendorCodeOf(it); if (c && !first.has(c)) first.set(c, i); });
  const rank = (it: PItem) => { const c = vendorCodeOf(it); return !c ? 1e9 : c === 'YSM' ? -2 : c === 'GOS' ? -1 : first.get(c)!; };
  const pfNo = (it: PItem) => parseInt(String(it.pfCode ?? '').match(/(\d+)$/)?.[1] ?? '9999', 10);
  return items.map((it, i) => ({ it, i })).sort((a, b) => rank(a.it) - rank(b.it) || pfNo(a.it) - pfNo(b.it) || a.i - b.i).map(x => x.it);
}

export function headName(p: { projectNo: string | number; projectName?: string }): string {
  const name = (p.projectName ?? '').trim();
  return name ? name.split(' - ')[0] : String(p.projectNo);
}
export function headAddress(p: { projectName?: string }): string {
  const parts = (p.projectName ?? '').split(' - ');
  return parts.slice(1).join(' - ').trim();
}
