// Production board data model: row types, columns, and the pure helpers the board UI, the
// API route and the Excel export all share. No exceljs here — safe to import from any page.

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

const DATE_COLS: ColumnKey[] = ['std', 'etd', 'rtd', 'rtr', 'rdy', 'ftd', 'snd', 'containerDate'];
const USD_COLS: ColumnKey[] = ['pfUsd', 'invoice', 'expensesUsd'];
const TL_COLS: ColumnKey[] = ['pfTl', 'invoiceTl', 'expensesTl'];
export const isDateColumn = (c: ColumnKey) => DATE_COLS.includes(c);
export const isUsdColumn = (c: ColumnKey) => USD_COLS.includes(c);
export const isTlColumn = (c: ColumnKey) => TL_COLS.includes(c);
export const isMoneyColumn = (c: ColumnKey) => isUsdColumn(c) || isTlColumn(c);

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

/** Money cell → number. Strips currency symbols / separators; anything unparsable is 0. */
export function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Date cell → local midnight Date, or null when empty / invalid. */
export function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string | number | Date);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export type ProjectColor = 'orange' | 'blue' | 'green' | 'red';

export interface PItem {
  /** production_items.id (the Production tracker edits by it). */
  id?: string;
  /** The row's project / case (Production tracker: Add Item, editors). */
  projectId?: string | null;
  caseId?: string | null;
  /** Custom types: the type's short code (Add Item needs it). */
  customTypeCode?: string | null;
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
  /** Payments page only (/api/production/board?payments=1): the accounting "green table". */
  paidUsd1?: number | string | null; paidUsd2?: number | string | null;
  paidTl1?: number | string | null;  paidTl2?: number | string | null;
  paidUsd1Date?: string | null; paidUsd2Date?: string | null; paidTl1Date?: string | null; paidTl2Date?: string | null;
  invoiceNumber?: string | null; invoiceTransactionNo?: string | null; invoiceDate?: string | null;
  quickBook?: string | null; duePaid?: boolean | null;
}

export interface PProject {
  projectNo: string | number;
  projectName?: string;
  color?: ProjectColor;
  isUrgent?: boolean;
  /** Half-year assignment (Trust System "Half"): FIRST_HALF / SECOND_HALF + year. */
  halfOfYear?: string | null;
  halfYear?: number | null;
  containerDate?: string | null;
  bucket?: string;
  /** Production tracker: the T-ERP project or case behind the block, for the project menu. */
  id?: string;
  kind?: 'project' | 'direct_order' | 'missing_extra';
  /** The Trust System id (project / case), for "Belge Hazırla". */
  trustId?: string | null;
  /** The name and address the menu edits (the header shows them split from projectName). */
  editName?: string;
  editAddress?: string;
  items: PItem[];
}

export interface PSection {
  label: string;
  projects: PProject[];
  /** Production tracker grouped view: the PF group's number (the band is a group, not a region). */
  group?: number;
}

/** Item field by column key (columns map 1:1 to PItem fields). */
export const itemField = (item: PItem, col: ColumnKey): unknown => (item as Record<string, unknown>)[col];

/**
 * Project colour: explicit colour → green when every item is SENT → red when urgent or a container
 * lands within 10 days → blue when any PO is signed / ready to sign → orange.
 */
export function computeProjectColor(project: PProject): ProjectColor {
  if (project.color) return project.color;
  const items = project.items || [];

  const norm = (s: unknown) => String(s ?? '').trim().toUpperCase().replace(/[\s-]/g, '_');
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

/** Groups projects into region sections, in BUCKET_LABELS order; unknown buckets follow, sorted. */
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

/** Effective amount: the invoice when there is one, otherwise the PF price. */
export function effUsd(i: PItem): number { const inv = toNumber(i.invoice); return inv > 0 ? inv : toNumber(i.pfUsd); }
export function effTl(i: PItem): number { const inv = toNumber(i.invoiceTl); return inv > 0 ? inv : toNumber(i.pfTl); }

/** Items grouped by type: TYPE_ORDER first, then custom types alphabetically. */
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

/** One PO status for a type group: SIGNED only when every item is signed. */
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
