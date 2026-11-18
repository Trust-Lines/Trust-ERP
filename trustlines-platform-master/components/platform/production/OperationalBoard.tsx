'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  DEFAULT_VISIBLE_COLUMNS, COLUMN_LABELS,
  computeProjectColor, groupItemsByType, groupAllSent,
  vendorText, effUsd, effTl, toNumber, fmtDateCss,
  isDateColumn, isMoneyColumn, BOARD_CSS,
  type PSection, type PItem, type PProject, type ColumnKey,
} from '@/lib/excel/projectsExcelExport';
import { EmptyState } from '@/components/ui/empty-state';
import { CheckCheck, ChevronDown, ChevronRight, CircleCheck, CircleOff, Drill, Factory, Hourglass, Loader, Package, Pause, Send, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ColumnResizer, useColumnWidths, type SizedColumn } from '@/components/ui/column-resize';
import { ConfirmModal } from '@/components/ui/modal';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ProjectMenu } from './ProjectMenu';
import type { ProductionAccess } from '@/lib/production/access';
import type { PfGroup } from './ProductionFlags';
import { remainderFor, rowAccounting, type RowAccounting } from '@/lib/production/paymentsAccounting';
import type { PayField } from '@/lib/production/paymentFields';
import { EditItemPanel, OrderTypePicker, RowMenu, VendorPicker, useBoardLists, type PanelItem } from './BoardEditors';
import {
  PF_SIGN_OPTIONS, PO_SIGN_OPTIONS, STATUS_OPTIONS, currentFirst, normalizeSign, normalizeStatus, poRollup,
  signStyle, statusStyle, type StatusIconName, type StatusOption,
} from '@/lib/production/statuses';

// Figma "Production Board" (node 384:51717) orders RTR before RTD; the Excel export keeps its own order.
const COLS: ColumnKey[] = DEFAULT_VISIBLE_COLUMNS.map(c => (c === 'rtd' ? 'rtr' : c === 'rtr' ? 'rtd' : c));
const LABELS: Partial<Record<ColumnKey, string>> = {
  projectNo: 'Project #', poSignStatus: 'PO Status', pfUsd: 'PF/USD', pfTl: 'PF/TL', containerNo: 'Container#',
};
const WIDTHS: Partial<Record<ColumnKey, number>> = {
  projectNo: 118, type: 94, pfCode: 125, vendor: 231, orderType: 117, poSignStatus: 124, pfSignStatus: 124, status: 135,
  rdy: 102, snd: 124, pfUsd: 100, pfTl: 103, invoice: 101, invoiceTl: 117, paymentRule: 116,
};
const MONEY_COLS: ColumnKey[] = ['pfUsd', 'pfTl', 'invoice', 'invoiceTl'];
const NO_ACCESS: ProductionAccess = {
  tabProjects: false, tabMissingExtra: false, tabDirectOrders: false, viewMoney: false, export: false, editStatus: false,
  editRows: false, deleteRows: false, editProjects: false, deleteProjects: false, todo: false, groups: false, half: false,
  viewPf: false,
};
// Figma "Projects table" (TRUST-LINES ERP 728:13023, colours 728:14366 / 14370 / 14374 / 14378): a
// project's header row, its Project # box and its TOTAL row take the project's colour as a tone —
// the colour rule is unchanged, only the tones are new (globals.css tokens, light + dark):
//   default (was orange) → New Status 02 grey (#C0C0C0 / #2B2B2B, Figma 728:14366 as updated) · PO signed / ready → T2 blue
//   every row SENT → New Status 10 green  · urgent / container ≤ 10 days → T10 red
const PROJECT_TONE: Record<ReturnType<typeof computeProjectColor>, string> = { orange: 'n2', blue: 't2', green: 'n10', red: 't10' };
// Region bands (Figma 741:17517 / 17523 / 17528 / 17533): one colour per region, light text, a
// chevron that folds the region's projects away. HQ / TC have no design yet and use the NE colour.
const REGION_BG: Record<string, string> = { NE: '#465B6D', SE: '#3B472B', NW: '#2E5BA3', CVW: '#7A655E' };
function regionBg(label: string): string {
  const words = label.toUpperCase().split(/\s+/);
  const k = Object.keys(REGION_BG).find(r => words.includes(r));
  return k ? REGION_BG[k] : REGION_BG.NE;
}
const regionTitle = (label: string) => label.replace(/^TLines(?=\s)/i, 'T Lines');
const toneBg = (t: string) => `var(--status-${t}-bg)`;
const toneFg = (t: string) => `var(--status-${t}-fg)`;

// Every cell has a right border: vertical lines between all columns, like a spreadsheet.
const TD = 'overflow-hidden text-ellipsis whitespace-nowrap border-b border-r border-ui-divider bg-ui-page-bg px-2 py-2.5 text-left align-middle text-[12px] text-ui-body';
// Trust System behaviour: the column header and region bands stay on top while scrolling down,
// Project # and Type stay on the left while scrolling sideways, and the board scrolls inside a box
// that fits the window, so its horizontal scrollbar is always on screen.
const HEAD_H = 46;
const TYPE_TEXT = 'text-[14px] font-semibold text-[var(--color-secondary-700)] dark:text-ui-heading';

function money(col: ColumnKey, n: number): string {
  const sym = col === 'pfUsd' || col === 'invoice' ? '$' : '₺';
  return `${sym} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortDate(value: unknown): string {
  const [d, m, y] = fmtDateCss(value).split('/');
  return y ? `${Number(m)}/${Number(d)}/${y}` : '';
}

function cellValue(col: ColumnKey, item: PItem): React.ReactNode {
  if (col === 'vendor')   return vendorText(item.vendor);
  // An empty amount stays empty (only TOTAL rows write 0.00), as in the Trust System.
  if (isMoneyColumn(col)) { const n = toNumber((item as Record<string, unknown>)[col] as number); return n ? money(col, n) : ''; }
  if (isDateColumn(col))  return shortDate((item as Record<string, unknown>)[col]);
  const v = (item as Record<string, unknown>)[col];
  return v == null ? '' : String(v);
}

// Figma's red chips are pure red with white text; everything else keeps the Excel fill.
function Chip({ css, children }: { css: { bg: string; fg: string } | null; children: React.ReactNode }) {
  if (!children) return null;
  const red = css && ['#DC2626', '#FF0000'].includes(css.bg);
  return (
    <span
      className="inline-flex min-w-[70px] items-center justify-center whitespace-nowrap rounded-[4px] py-2 pl-2.5 pr-2 text-[12px] font-medium leading-4"
      style={{ background: red ? '#FF0000' : css?.bg ?? 'var(--status-n1-bg)', color: red ? '#FFFFFF' : css?.fg ?? 'var(--status-n1-fg)' }}
    >
      {children}
    </span>
  );
}

// ── Status cells (Trust System): PO SIGN STATUS (one per type group), PF SIGN STATUS and STATUS
// are filled with the status colour across the whole cell; clicking opens the list of statuses
// with their colours (current one first). Saves go to PATCH /api/production/items/:id, which sets
// the dates for a status change; a PO change is written to every row of the type, one by one.
type EditKind = 'status' | 'pf' | 'po';
const FIELD: Record<EditKind, string> = { status: 'status', pf: 'pf_sign_status', po: 'po_sign_status' };
const ITEM_KEY: Record<EditKind, keyof PItem> = { status: 'status', pf: 'pfSignStatus', po: 'poSignStatus' };
const OPTIONS: Record<EditKind, StatusOption[]> = { status: STATUS_OPTIONS, pf: PF_SIGN_OPTIONS, po: PO_SIGN_OPTIONS };
const MENU_W = 240;
const MENU_MAX_H = 360;
interface OpenMenu { kind: EditKind; ids: string[]; current: string; rect: DOMRect }

// Figma "Status Chip" (TRUST-LINES ERP 722:804 light / 722:910 dark): 14px icon + 12px medium label,
// 4px radius, 3px × 8/12px padding, coloured by the status tone (globals.css tokens, theme-aware).
const ICONS: Record<Exclude<StatusIconName, 'circle-dashed-check'>, LucideIcon> = {
  pause: Pause, 'circle-off': CircleOff, package: Package, loader: Loader, hourglass: Hourglass, drill: Drill,
  'check-check': CheckCheck, 'circle-check': CircleCheck, send: Send,
};
function StatusIcon({ name }: { name: StatusIconName }) {
  // circle-dashed-check isn't in this lucide-react version: the Figma asset, painted in the text colour.
  if (name === 'circle-dashed-check') {
    return (
      <span aria-hidden className="size-[14px] shrink-0 bg-current"
        style={{ maskImage: 'url(/icons/circle-dashed-check.svg)', WebkitMaskImage: 'url(/icons/circle-dashed-check.svg)', maskSize: '100% 100%', WebkitMaskSize: '100% 100%' }} />
    );
  }
  const Icon = ICONS[name];
  return <Icon aria-hidden className="size-[14px] shrink-0" strokeWidth={2} />;
}
export function StatusChip({ opt, className }: { opt: StatusOption; className?: string }) {
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1 rounded-[4px] py-[3px] pl-2 pr-3 text-[12px] font-medium leading-4 whitespace-nowrap', className)}
      style={{ background: opt.bg, color: opt.fg }}>
      <StatusIcon name={opt.icon} />
      <span className="truncate">{opt.label}</span>
    </span>
  );
}

// In the table the chip is a full box: it fills the cell (a merged PO cell from the type's first row
// to its last) with a margin on every side, icon and label centred.
function StatusCell({ opt, rowSpan, editable, onOpen }: {
  opt: StatusOption; rowSpan?: number; editable: boolean; onOpen: (anchor: HTMLElement) => void;
}) {
  return (
    <td
      rowSpan={rowSpan}
      className={cn('group/status relative overflow-hidden whitespace-nowrap border-b border-r border-ui-divider bg-ui-page-bg p-0 align-middle',
        editable && 'cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ui-focus-ring')}
      tabIndex={editable ? 0 : undefined}
      aria-haspopup={editable ? 'listbox' : undefined}
      onClick={editable ? e => onOpen(e.currentTarget) : undefined}
      onKeyDown={editable ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(e.currentTarget); } } : undefined}
    >
      <StatusChip opt={opt} className={cn('absolute inset-[5px] max-w-none justify-center rounded-[6px] px-2', editable && 'group-hover/status:brightness-95')} />
    </td>
  );
}

function StatusMenu({ menu, onPick, onClose }: { menu: OpenMenu; onPick: (value: string) => void; onClose: () => void }) {
  useEffect(() => {
    // Scrolling the page or the board closes the list; scrolling the list itself does not.
    // (Escape and outside clicks are handled by the shared Popover.)
    const onScroll = (e: Event) => { if (!(e.target instanceof Element && e.target.closest('[data-board-popup]'))) onClose(); };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);
  const anchor = useMemo(() => ({ getBoundingClientRect: () => menu.rect }), [menu.rect]);
  return (
    <Popover open onOpenChange={o => { if (!o) onClose(); }}>
      <PopoverContent data-board-popup backdrop role="listbox" aria-label="Choose a status" anchor={anchor} align="start" sideOffset={2}
        style={{ width: MENU_W, maxHeight: MENU_MAX_H }}
        className="gap-1 overflow-y-auto p-1.5">
        {currentFirst(OPTIONS[menu.kind], menu.current).map(o => (
          <button
            key={o.value} type="button" role="option" aria-selected={o.value === menu.current} autoFocus={o.value === menu.current}
            onClick={() => onPick(o.value)}
            className={cn('flex cursor-pointer flex-col items-start gap-0.5 rounded-[4px] border-0 bg-transparent px-1.5 py-1 text-left hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-ui-focus-ring',
              o.value === menu.current && 'bg-ui-selected-bg')}
          >
            <StatusChip opt={o} />
            {o.hint && <span className="pl-1 text-[11px] text-ui-text-secondary">{o.hint}</span>}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// Row order inside a type group (Trust System): YSM, then GOS, then the other vendors in the order
// they first appear, vendor-less rows last; within a vendor by PF number, then as created.
function vendorCodeOf(it: PItem): string {
  const v = it.vendor;
  return (typeof v === 'string' ? v.split(' - ')[0] : v?.code ?? '').toUpperCase();
}
function sortForDisplay(items: PItem[]): PItem[] {
  const first = new Map<string, number>();
  items.forEach((it, i) => { const c = vendorCodeOf(it); if (c && !first.has(c)) first.set(c, i); });
  const rank = (it: PItem) => { const c = vendorCodeOf(it); return !c ? 1e9 : c === 'YSM' ? -2 : c === 'GOS' ? -1 : first.get(c)!; };
  const pfNo = (it: PItem) => parseInt(String(it.pfCode ?? '').match(/(\d+)$/)?.[1] ?? '9999', 10);
  return items.map((it, i) => ({ it, i })).sort((a, b) => rank(a.it) - rank(b.it) || pfNo(a.it) - pfNo(b.it) || a.i - b.i).map(x => x.it);
}

// No order type yet = an empty cell (was a red "-" chip), as in the Trust System.
function OrderType({ value }: { value?: string | null }) {
  // The table grey (Figma 728:14366, New Status 01: #EBEBEB / #3D3D43, dark #3D3D43 / #DDDDDD).
  return value ? <Chip css={{ bg: 'var(--status-n1-bg)', fg: 'var(--status-n1-fg)' }}>{value}</Chip> : null;
}

function headName(p: { projectNo: string | number; projectName?: string }): string {
  const name = (p.projectName ?? '').trim();
  return name ? name.split(' - ')[0] : String(p.projectNo);
}
function headAddress(p: { projectName?: string }): string {
  const parts = (p.projectName ?? '').split(' - ');
  return parts.slice(1).join(' - ').trim();
}

// ── Payments page (Figma TRUST-LINES ERP "Payments" 935:22284): four cards side by side, 32px
// apart — Project (the board, T10 red), Accounting (T7), Payments Grand Total (T6) and Invoice &
// Receipt (dark grey). They are one table, so every row lines up across the cards; the gaps are
// empty columns. Each card has a title bar (52px) and its column headings (46px); a project's
// band carries white labels (1st / 2nd / Remaining …) in the project's colour, its TOTAL row white
// amount chips. Roles with "Edit payments" type into the paid / date / invoice cells (saved on
// blur through /api/payments/items/:id); everything else is computed (lib/production/paymentsAccounting).
type PayGroup = 'acc' | 'tl' | 'inv';
type PayKind = 'usd' | 'tl' | 'date' | 'text' | 'qb';
interface PayCol { key: string; group: PayGroup; label: string; kind: PayKind; w: number; get: (it: PItem, a: RowAccounting) => number | string | null | undefined; field?: PayField }
interface CardTone { title: React.CSSProperties; head: React.CSSProperties }
const cardTone = (t: string, titleBg?: string): CardTone => ({
  title: { background: titleBg ?? `var(--status-${t}-fg)`, color: `var(--status-${t}-bg)` },
  head: { background: `var(--status-${t}-bg)`, color: `var(--status-${t}-fg)` },
});
const PROJECT_CARD = cardTone('t10');
const PAY_GROUPS: { group: PayGroup; title: string; total: string; tone: CardTone; pills: [string, number][] }[] = [
  { group: 'acc', title: 'Accounting', total: 'Accounting Grand Total', tone: cardTone('t7'),
    pills: [['1st', 2], ['2nd', 2], ['1st', 2], ['2nd', 2], ['Remaining', 2], ['Not Ordered', 2]] },
  { group: 'tl', title: 'Payments Grand Total', total: 'Payments Grand Total', tone: cardTone('t6'),
    pills: [['Due Payment', 2], ['Payments 1', 2], ['Payments 2', 2]] },
  { group: 'inv', title: 'Invoice & Receipt', total: '', tone: cardTone('t0', 'var(--status-n1-fg)'),
    pills: [['Invoices & Receipts', 4]] },
];
const PAY_COLS: PayCol[] = [
  { key: 'paidUsd1', group: 'acc', label: 'Paid/USD', kind: 'usd', w: 140, get: (_, a) => a.paidUsd1, field: 'paid_usd1' },
  { key: 'paidUsd1Date', group: 'acc', label: 'Date', kind: 'date', w: 156, get: it => it.paidUsd1Date, field: 'paid_usd1_date' },
  { key: 'paidUsd2', group: 'acc', label: 'Paid/USD', kind: 'usd', w: 140, get: (_, a) => a.paidUsd2, field: 'paid_usd2' },
  { key: 'paidUsd2Date', group: 'acc', label: 'Date', kind: 'date', w: 156, get: it => it.paidUsd2Date, field: 'paid_usd2_date' },
  { key: 'paidTl1', group: 'acc', label: 'Paid/TL', kind: 'tl', w: 140, get: (_, a) => a.paidTl1, field: 'paid_tl1' },
  { key: 'paidTl1Date', group: 'acc', label: 'Date', kind: 'date', w: 156, get: it => it.paidTl1Date, field: 'paid_tl1_date' },
  { key: 'paidTl2', group: 'acc', label: 'Paid/TL', kind: 'tl', w: 140, get: (_, a) => a.paidTl2, field: 'paid_tl2' },
  { key: 'paidTl2Date', group: 'acc', label: 'Date', kind: 'date', w: 156, get: it => it.paidTl2Date, field: 'paid_tl2_date' },
  { key: 'remUsd', group: 'acc', label: 'USD', kind: 'usd', w: 132, get: (_, a) => a.remainingUsd },
  { key: 'remTl', group: 'acc', label: 'TL', kind: 'tl', w: 132, get: (_, a) => a.remainingTl },
  { key: 'noUsd', group: 'acc', label: 'USD', kind: 'usd', w: 132, get: (_, a) => a.notOrderedUsd },
  { key: 'noTl', group: 'acc', label: 'TL', kind: 'tl', w: 132, get: (_, a) => a.notOrderedTl },
  // Due Payment (computed): the advance by the payment rule while WAITING_PAYMENT, all of it once
  // the goods are ready / received / sent. Payments 1 / 2 are Paid 1 / 2 again (the same fields).
  { key: 'dueUsd', group: 'tl', label: 'USD', kind: 'usd', w: 132, get: (_, a) => a.dueUsd },
  { key: 'dueTl', group: 'tl', label: 'TL', kind: 'tl', w: 132, get: (_, a) => a.dueTl },
  { key: 'pay1Usd', group: 'tl', label: 'USD', kind: 'usd', w: 140, get: (_, a) => a.paidUsd1, field: 'paid_usd1' },
  { key: 'pay1Tl', group: 'tl', label: 'TL', kind: 'tl', w: 140, get: (_, a) => a.paidTl1, field: 'paid_tl1' },
  { key: 'pay2Usd', group: 'tl', label: 'USD', kind: 'usd', w: 140, get: (_, a) => a.paidUsd2, field: 'paid_usd2' },
  { key: 'pay2Tl', group: 'tl', label: 'TL', kind: 'tl', w: 140, get: (_, a) => a.paidTl2, field: 'paid_tl2' },
  { key: 'txNo', group: 'inv', label: 'Transaction #', kind: 'text', w: 170, get: it => it.invoiceTransactionNo, field: 'invoice_transaction_no' },
  { key: 'invNo', group: 'inv', label: 'Invoice #', kind: 'text', w: 200, get: it => it.invoiceNumber, field: 'invoice_number' },
  { key: 'qb', group: 'inv', label: 'Quickbook', kind: 'qb', w: 132, get: it => it.quickBook, field: 'quick_book' },
  { key: 'invDate', group: 'inv', label: 'Date', kind: 'date', w: 156, get: it => it.invoiceDate, field: 'invoice_date' },
];
const TITLE_H = 52;
const GAP_W = 32;
const groupCols = (g: PayGroup) => PAY_COLS.filter(c => c.group === g);
const startsGroup = (i: number) => i === 0 || PAY_COLS[i - 1].group !== PAY_COLS[i].group;
// Dollars in the T6 green, lira in the orange of the design (--pay-usd-fg / --pay-tl-fg).
const moneyFg = (k: PayKind) => (k === 'usd' ? 'var(--pay-usd-fg)' : 'var(--pay-tl-fg)');
const payMoney = (kind: PayKind, n: number) => `${kind === 'usd' ? '$' : '₺'} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const isMoney = (k: PayKind) => k === 'usd' || k === 'tl';
/** The totals of the money columns over some rows. */
function payTotals(items: PItem[]): Record<string, number> {
  const t: Record<string, number> = {};
  for (const it of items) {
    const a = rowAccounting(it);
    for (const c of PAY_COLS) if (isMoney(c.kind)) t[c.key] = (t[c.key] ?? 0) + toNumber(c.get(it, a) as number);
  }
  return t;
}
/** The empty column between two cards. */
function Gap({ th }: { th?: boolean }) {
  return th ? <th aria-hidden className="sticky top-0 z-20 border-0 bg-ui-page-bg p-0" /> : <td aria-hidden className="border-0 bg-ui-page-bg p-0" />;
}
// Spreadsheet lines like the Project card: every column has a right border, the card's first
// column also its left edge.
const edge = (i: number) => cn(startsGroup(i) && 'border-l border-l-ui-divider', 'border-r border-r-ui-divider');
function WhiteChip({ children, color, big }: { children: React.ReactNode; color?: string; big?: boolean }) {
  return (
    <span className={cn('inline-flex items-center justify-center whitespace-nowrap rounded-[4px] bg-ui-page-bg font-medium', big ? 'w-full px-2 py-1 text-[16px] text-[var(--color-secondary-700)] dark:text-ui-heading' : 'min-w-[70px] py-1 pl-2.5 pr-2 text-[12px] leading-4')}
      style={color ? { color } : undefined}>
      {children}
    </span>
  );
}
const CELL = 'overflow-hidden text-ellipsis whitespace-nowrap border-b border-b-ui-divider bg-ui-page-bg px-3 py-2.5 align-middle text-[14px] font-medium';
const INPUT = 'w-full min-w-0 rounded-[4px] border border-transparent bg-transparent px-1 py-0.5 text-[14px] font-medium outline-none hover:border-ui-input-border focus:border-ui-focus-ring focus:bg-ui-input-bg';
const rawDate = (v: unknown) => (v ? String(v).slice(0, 10) : '');
const plain = (n: number) => (Math.round(n * 100) / 100).toString();

async function savePayment(id: string, field: PayField, value: string | number | null): Promise<boolean> {
  const res = await fetch(`/api/payments/items/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }),
  }).catch(() => null);
  if (res?.ok) return true;
  const b = await res?.json().catch(() => null);
  toast.error(b?.error ?? 'Could not save the payment');
  return false;
}

/** One typed cell of the accounting sheet: amount, date, text or the QuickBook toggle. */
function PayInput({ item, col, a, onSaved }: { item: PItem; col: PayCol; a: RowAccounting; onSaved: () => void }) {
  const field = col.field!;
  const original = col.kind === 'date' ? rawDate(col.get(item, a)) : isMoney(col.kind)
    ? (() => { const v = (item as Record<string, unknown>)[{ paid_usd1: 'paidUsd1', paid_usd2: 'paidUsd2', paid_tl1: 'paidTl1', paid_tl2: 'paidTl2' }[field as 'paid_usd1'] ?? '']; return v == null || v === '' ? '' : plain(toNumber(v as number)); })()
    : String(col.get(item, a) ?? '');
  // What is shown: the saved value until the reloaded board brings the new one.
  const [shown, setShown] = useState(original);
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => { setShown(original); }, [original]);

  async function commit(next: string) {
    setDraft(null);
    if (next === shown) return;
    const prev = shown;
    setShown(next);
    const value = next === '' ? null : isMoney(col.kind) ? Number(next) : next;
    if (await savePayment(item.id!, field, value)) onSaved(); else setShown(prev);
  }

  if (col.kind === 'qb') {
    const done = shown === 'Done';
    return (
      <button type="button" aria-pressed={done} aria-label={done ? 'QuickBook done — click to clear' : 'Mark QuickBook done'}
        onClick={() => void commit(done ? '' : 'Done')}
        className="inline-flex w-[81px] cursor-pointer items-center justify-center rounded-[4px] border-0 py-2 pl-2.5 pr-2 text-[12px] font-medium uppercase leading-4 focus-visible:outline-2 focus-visible:outline-ui-focus-ring"
        style={done ? { background: 'var(--status-t9-bg)', color: 'var(--status-t9-fg)' } : { background: 'transparent', color: 'var(--ui-text-secondary)' }}>
        {done ? 'Done' : '—'}
      </button>
    );
  }
  if (col.kind === 'date') {
    return (
      <input type="date" aria-label={`${col.label} (${col.field})`} value={draft ?? shown} className={cn(INPUT, 'text-ui-text-secondary')}
        onChange={e => setDraft(e.target.value)} onBlur={e => void commit(e.target.value)} />
    );
  }
  if (col.kind === 'text') {
    return (
      <input type="text" aria-label={col.label} maxLength={120} value={draft ?? shown} title={shown || undefined}
        className={cn(INPUT, 'text-[var(--color-secondary-700)] dark:text-ui-heading')}
        onChange={e => setDraft(e.target.value)} onBlur={e => void commit(e.target.value.trim())}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur(); } }} />
    );
  }
  // Amounts: digits and one point, 2 decimals; the raw number while typing, formatted otherwise.
  const editing = draft !== null;
  const rem = remainderFor(a, field as 'paid_usd1');
  return (
    <span className="relative block">
      <input type="text" inputMode="decimal" aria-label={`${col.label} ${field}`}
        value={editing ? draft : shown === '' ? '' : payMoney(col.kind, Number(shown))}
        placeholder={payMoney(col.kind, 0)}
        className={INPUT} style={{ color: moneyFg(col.kind) }}
        onFocus={() => setDraft(shown)}
        onChange={e => { const v = e.target.value.replace(/[^\d.]/g, ''); if (/^\d*(\.\d{0,2})?$/.test(v)) setDraft(v); }}
        onBlur={e => void commit(e.target.value.replace(/\.$/, ''))}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur(); } }} />
      {/* "Rem:" — what is left of the invoice after the other payment; one click writes it. */}
      {editing && rem > 0 && (
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => void commit(plain(rem))}
          className="absolute left-0 top-full z-30 mt-1 cursor-pointer whitespace-nowrap rounded-[4px] border border-ui-divider bg-ui-surface-elevated px-2 py-1 text-[12px] font-medium text-ui-body shadow-sm hover:bg-ui-hover-bg">
          Rem: {payMoney(col.kind, rem)}
        </button>
      )}
    </span>
  );
}

function PayCells({ item, edit, onSaved }: { item: PItem; edit: boolean; onSaved: () => void }) {
  const a = rowAccounting(item);
  return (
    <>
      {PAY_COLS.map((c, i) => {
        const v = c.get(item, a);
        const n = isMoney(c.kind) ? toNumber(v as number) : 0;
        const typed = edit && !!c.field && !!item.id;
        return (
          <Fragment key={c.key}>
            {startsGroup(i) && <Gap />}
            <td className={cn(CELL, edge(i), typed && 'overflow-visible px-2 py-1.5')}>
              {typed ? <PayInput item={item} col={c} a={a} onSaved={onSaved} />
                // PF not signed: Remaining says so in red; its TL cell stays empty.
                : c.key === 'remUsd' && a.notSigned ? <span className="text-[12px] font-semibold uppercase" style={{ color: 'var(--status-t10-fg)' }}>Not signed</span>
                : c.key === 'remTl' && a.notSigned ? null
                : isMoney(c.kind) ? <span style={{ color: moneyFg(c.kind) }}>{payMoney(c.kind, n)}</span>
                : c.kind === 'date' ? <span className="text-ui-text-secondary">{shortDate(v)}</span>
                : c.kind === 'qb' ? (v ? <span className="inline-flex w-[81px] items-center justify-center rounded-[4px] py-2 pl-2.5 pr-2 text-[12px] font-medium uppercase leading-4"
                    style={{ background: 'var(--status-t9-bg)', color: 'var(--status-t9-fg)' }}>{String(v)}</span> : null)
                : <span className="text-[var(--color-secondary-700)] dark:text-ui-heading">{v == null ? '' : String(v)}</span>}
            </td>
          </Fragment>
        );
      })}
    </>
  );
}
/** A project's band on the payment cards: its colour, white labels over the column pairs. */
function PayHeadBand({ style }: { style: React.CSSProperties }) {
  return (
    <>
      {PAY_GROUPS.map(g => (
        <Fragment key={g.group}>
          <Gap />
          {g.pills.map(([label, n], pi) => (
            <td key={pi} colSpan={n} className={cn('border-y border-r border-ui-divider px-4 py-2', pi === 0 && 'border-l')} style={style}>
              <WhiteChip big>{label}</WhiteChip>
            </td>
          ))}
        </Fragment>
      ))}
    </>
  );
}
/** A region band on the payment cards: the region colour, nothing written. */
function PayBand({ background, top }: { background: string; top: number }) {
  return (
    <>
      {PAY_GROUPS.map(g => (
        <Fragment key={g.group}>
          <Gap />
          <td colSpan={groupCols(g.group).length} className="sticky z-[15] border border-ui-divider p-2" style={{ background, top }} />
        </Fragment>
      ))}
    </>
  );
}
/** TOTAL cells: white amount chips; `styleOf` colours each card's part of the row. */
function PayTotalCells({ totals, styleOf, labels }: { totals: Record<string, number>; styleOf: (g: PayGroup) => React.CSSProperties; labels?: boolean }) {
  return (
    <>
      {PAY_GROUPS.map(g => {
        const cs = groupCols(g.group);
        return (
          <Fragment key={g.group}>
            <Gap />
            {labels && g.total && <td colSpan={2} className="border-y border-x border-ui-divider px-4 py-2.5 text-[14px] font-semibold whitespace-nowrap" style={styleOf(g.group)}>{g.total}</td>}
            {(labels && g.total ? cs.slice(2) : cs).map((c, i) => (
              <td key={c.key} className={cn('border-y border-r border-ui-divider px-2 py-2', i === 0 && !(labels && g.total) && 'border-l')} style={styleOf(g.group)}>
                {isMoney(c.kind) && <WhiteChip color={moneyFg(c.kind)}>{payMoney(c.kind, totals[c.key] ?? 0)}</WhiteChip>}
              </td>
            ))}
          </Fragment>
        );
      })}
    </>
  );
}

function MoneyChip({ col, value }: { col: ColumnKey; value: number }) {
  return (
    <span className="inline-flex min-w-[70px] items-center justify-center whitespace-nowrap rounded-[4px] bg-ui-page-bg py-1 pl-2.5 pr-2 text-[12px] font-medium leading-4 text-[var(--color-secondary-700)] dark:text-ui-heading">
      {money(col, value)}
    </span>
  );
}

export function OperationalBoard({ sections, access = NO_ACCESS, groups = [], onGroupsChanged, onSaved, groupRanks, selection, payments = false, payEdit = false }: {
  sections: PSection[];
  /** Payments: this role may type into the paid / date / invoice cells ("Edit payments"). */
  payEdit?: boolean;
  /** Payments page: the Accounting / Payments T Lines / Invoice & Receipt tables to the right. */
  payments?: boolean;
  /** Roles page → Production Board switches. */
  access?: ProductionAccess;
  groups?: PfGroup[]; onGroupsChanged?: () => void; onSaved?: () => void;
  /** Groups view: rank of "group|projectId|type" for the type cell's badge. */
  groupRanks?: Map<string, number>;
  /** Half toolbar: the selection box on each Project # cell, shown once "Select" was used. */
  selection?: { selected: Set<string>; toggle: (id: string) => void; visible: boolean };
}) {
  // Column widths like the accounting sheet: fit the widest text, drag a header edge to resize,
  // double-click to fit again; remembered in this browser.
  const allItems = useMemo(() => sections.flatMap(s => s.projects.flatMap(p => p.items ?? [])), [sections]);
  const sizing = useMemo<SizedColumn<PItem>[]>(() => COLS.map(col => ({
    id: col, label: LABELS[col] ?? COLUMN_LABELS[col],
    text: (it: PItem) => (col === 'projectNo' ? '' : col === 'pfSignStatus' ? signStyle(it.pfSignStatus).label
      : col === 'poSignStatus' ? signStyle(it.poSignStatus).label : col === 'status' ? statusStyle(it.status).label
      : String(cellValue(col, it) ?? '')),
    chip: col === 'orderType' || col === 'status' || col === 'pfSignStatus' || col === 'poSignStatus',
    min: WIDTHS[col] && (col === 'projectNo' || col === 'type') ? WIDTHS[col] : 64,
  })), []);
  const { width, startResize, fit } = useColumnWidths('production-tracker-widths', sizing, allItems);
  const typeLeft = width('projectNo');
  const canStatus = access.editStatus, canRows = access.editRows, canDelRows = access.deleteRows;
  // Without "Money columns" the four money columns and the TOTAL rows are left out.
  const cols = COLS.filter(c => (access.viewMoney || !MONEY_COLS.includes(c)) && (access.viewPf || (c !== 'pfCode' && c !== 'pfSignStatus')));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const lists = useBoardLists();
  const [picker, setPicker] = useState<{ kind: 'vendor' | 'orderType'; item: PItem; rect: DOMRect } | null>(null);
  const [panel, setPanel] = useState<{ key: string; point: { x: number; y: number } } | null>(null);
  const [rowMenu, setRowMenu] = useState<{ item: PItem; point: { x: number; y: number } } | null>(null);
  const [toDelete, setToDelete] = useState<PItem | null>(null);
  // Project menu (right click on a Project # box or a project header).
  const [projMenu, setProjMenu] = useState<{ project: PProject; headKey: string } | null>(null);
  const [projToDelete, setProjToDelete] = useState<PProject | null>(null);
  const openProjMenu = (e: React.MouseEvent, project: PProject, headKey: string) => {
    if (!project.id) return;
    e.preventDefault();
    e.stopPropagation();
    setProjMenu(m => (m?.headKey === headKey ? null : { project, headKey }));
  };
  async function deleteProject(p: PProject) {
    const res = await fetch(`/api/production/blocks/${p.id}?kind=${p.kind ?? 'project'}`, { method: 'DELETE' }).catch(() => null);
    const b = await res?.json().catch(() => ({}));
    if (!res?.ok) { toast.error(b?.error ?? 'Could not delete the project'); throw new Error('delete'); }
    toast.success('Project moved to the trash');
    onSaved?.();
  }

  /** PATCH one row; the reloaded board shows what the server saved (PF code included). */
  async function patchItem(id: string, body: Record<string, unknown>, show?: Partial<PItem>) {
    if (show) setPending(p => ({ ...p, [id]: { ...p[id], ...show } }));
    const res = await fetch(`/api/production/items/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    const b = await res?.json().catch(() => ({}));
    onSaved?.();
    if (!res?.ok) { const msg = b?.error ?? 'Could not save'; toast.error(msg); throw new Error(msg); }
  }
  const pickVendor = (item: PItem, v: { id: string; code: string | null; name: string } | null) =>
    patchItem(item.id!, { vendor_id: v?.id ?? null }, { vendorId: v?.id ?? null, vendor: v ? { code: v.code, name: v.name } : null }).catch(() => {});
  const pickOrderType = (item: PItem, name: string | null) =>
    patchItem(item.id!, { order_type: name }, { orderType: name }).catch(() => {});
  async function addItem(g: { type: string; projectId: string | null; caseId: string | null; customTypeCode: string | null }): Promise<string | null> {
    const res = await fetch('/api/production/items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: g.caseId ? undefined : g.projectId, caseId: g.caseId ?? undefined, type: g.type, customTypeCode: g.customTypeCode ?? undefined }),
    }).catch(() => null);
    const b = await res?.json().catch(() => ({}));
    if (!res?.ok) { toast.error(b?.error ?? 'Could not add the item'); return null; }
    onSaved?.();
    return b.item?.id ?? null;
  }
  async function deleteItem(item: PItem) {
    const res = await fetch(`/api/production/items/${item.id}`, { method: 'DELETE' }).catch(() => null);
    if (!res?.ok) { toast.error('Could not delete the row'); throw new Error('delete'); }
    toast.success('Row moved to the trash');
    onSaved?.();
  }
  // Picked values show at once, until the reloaded board has them.
  const [pending, setPending] = useState<Record<string, Partial<PItem>>>({});
  useEffect(() => { setPending({}); }, [sections]);
  const view = (it: PItem): PItem => (it.id && pending[it.id] ? { ...it, ...pending[it.id] } : it);

  function openMenu(kind: EditKind, ids: string[], current: string, anchor: HTMLElement) {
    if (!canStatus || !ids.length) return;
    setMenu({ kind, ids, current, rect: anchor.getBoundingClientRect() });
  }

  async function pick(value: string) {
    if (!menu) return;
    const { kind, ids, current } = menu;
    setMenu(null);
    if (value === current) return;
    setPending(p => ({ ...p, ...Object.fromEntries(ids.map(id => [id, { ...p[id], [ITEM_KEY[kind]]: value }])) }));
    let failed = 0;
    // One row after another, never in parallel (PF codes are numbered as rows change).
    for (const id of ids) {
      const res = await fetch(`/api/production/items/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [FIELD[kind]]: value }),
      }).catch(() => null);
      if (!res?.ok) failed++;
    }
    if (failed) toast.error(failed === ids.length ? 'Could not save the status' : `${failed} of ${ids.length} rows could not be saved`);
    onSaved?.();
  }
  const nonEmpty = sections.filter(s => s.projects.length > 0);

  function toggle(key: string) {
    setCollapsed(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }

  const moneyStart = cols.indexOf('pfUsd');
  const afterMoney = cols.length - cols.indexOf('invoiceTl') - 1;
  // The frozen left block: Project # and Type. Every full-width row (region band, project band,
  // TOTAL) is split so its left part stays there too, and the rest of the table runs beside it.
  const FROZEN = 2;
  const FROZEN_TD = 'sticky left-0 z-10 overflow-hidden';
  const payCols = payments ? PAY_COLS : [];
  // The latest onSaved for the payment cells, without rebuilding the body when it changes.
  const savedRef = useRef(onSaved);
  useEffect(() => { savedRef.current = onSaved; }, [onSaved]);
  const reload = useCallback(() => savedRef.current?.(), []);
  // Payments: the cards' title bar sits over the column headings, so the region bands stick lower.
  const headH = payments ? HEAD_H + TITLE_H : HEAD_H;

  // The table body is the expensive part of this board (profiled: ~80 ms for 400 rows, ~310 ms for
  // 1,600). It depends only on the data, pending edits, collapsed groups, column widths and access /
  // selection — never on which popup is open — so it is built once per change of those and reused
  // while a status list, picker, panel or menu opens and closes. Its handlers only call state
  // setters (stable) or read values that are in the dependency list.
  const colWidthKey = cols.map(c => width(c)).join(',');
  const { body, groupsByKey } = useMemo(() => {
    // The type groups drawn in the body, for the Edit Item panel.
    const groupsByKey = new Map<string, { type: string; items: PItem[]; projectId: string | null; caseId: string | null; customTypeCode: string | null }>();
    const body = (
          <tbody>
            {nonEmpty.map((section, si) => {
              let secUsd = 0, secTl = 0, secInv = 0, secInvTl = 0;
  
              const projectRows = section.projects.map((project, pi) => {
                const groups = groupItemsByType(project.items || []);
                const dataRowCount = groups.reduce((n, g) => n + g.items.length, 0);
                const tone = PROJECT_TONE[computeProjectColor(project)];
                const barStyle = { background: toneBg(tone), color: toneFg(tone) };
                const key = `${section.label}:${project.projectNo}`;
                const isCollapsed = collapsed.has(key);
                const Chevron = isCollapsed ? ChevronRight : ChevronDown;
  
                const totals: Partial<Record<ColumnKey, number>> = {};
                for (const it of project.items || []) {
                  totals.pfUsd = (totals.pfUsd ?? 0) + toNumber(it.pfUsd);
                  totals.pfTl = (totals.pfTl ?? 0) + toNumber(it.pfTl);
                  totals.invoice = (totals.invoice ?? 0) + toNumber(it.invoice);
                  totals.invoiceTl = (totals.invoiceTl ?? 0) + toNumber(it.invoiceTl);
                  secUsd += effUsd(it); secTl += effTl(it);
                  secInv += toNumber(it.invoice); secInvTl += toNumber(it.invoiceTl);
                }
  
                let dataRowSeen = 0;
                const bodyRows: React.ReactNode[] = [];
                groups.forEach((group, gi) => {
                  const shown = sortForDisplay(group.items.map(view));
                  const groupKey = `${shown[0]?.caseId ?? shown[0]?.projectId ?? project.projectNo}|${group.type}`;
                  groupsByKey.set(groupKey, { type: group.type, items: shown, projectId: shown[0]?.projectId ?? null, caseId: shown[0]?.caseId ?? null, customTypeCode: shown[0]?.customTypeCode ?? null });
                  const allSent = groupAllSent(shown);
                  const po = poRollup(shown.map(i => i.poSignStatus));
                  shown.forEach((item, ii) => {
                    const isFirstDataRow = dataRowSeen === 0;
                    const isFirstOfGroup = ii === 0;
                    dataRowSeen++;
                    bodyRows.push(
                      <tr key={`${pi}-${gi}-${ii}`}
                        onContextMenu={canDelRows && item.id ? e => { e.preventDefault(); setRowMenu({ item, point: { x: e.clientX, y: e.clientY } }); } : undefined}>
                        {cols.map(col => {
                          if (col === 'projectNo') {
                            if (!isFirstDataRow) return null;
                            return (
                              <td key={col} rowSpan={dataRowCount} className={cn('sticky left-0 z-10 border-r border-ui-divider bg-ui-page-bg p-0', project.id && 'cursor-pointer')}
                                onContextMenu={e => openProjMenu(e, project, key)}>
                                {/* A rounded box inside the cell: 7px page-colour margin, 12px corners. */}
                                {(() => {
                                  // "P123" shows as "123" (Trust System). Long case codes ("STRAFORD-RE-1",
                                  // "344-EX-1") get a smaller size so they fit the box, even on a one-row project.
                                  const no = String(project.projectNo).replace(/^P(?=\d+$)/, '');
                                  const size = no.length <= 8 ? (dataRowCount > 1 ? 24 : 20) : no.length <= 11 ? 15 : 12;
                                  return (
                                    <span title={no} className="absolute inset-[7px] flex items-center justify-center overflow-hidden rounded-[12px] px-1.5 text-center font-medium leading-[1.15] [overflow-wrap:anywhere]"
                                      style={{ ...barStyle, fontSize: size }}>
                                      {no}
                                    </span>
                                  );
                                })()}
                                {/* Half selection: only selects, never opens the menu. */}
                                {selection?.visible && project.id && (
                                  <Checkbox aria-label={`Select project ${project.projectNo}`} checked={selection.selected.has(project.id)}
                                    onCheckedChange={() => selection.toggle(project.id!)} onClick={e => e.stopPropagation()} onContextMenu={e => e.stopPropagation()}
                                    className="absolute left-[11px] top-[11px] z-[1]" />
                                )}
                              </td>
                            );
                          }
                          if (col === 'type') {
                            if (!isFirstOfGroup) return null;
                            return (
                              <td key={col} rowSpan={group.items.length} className={cn(TD, TYPE_TEXT, 'sticky z-10 border-r', canRows && 'cursor-pointer hover:brightness-95')}
                                onClick={canRows ? e => setPanel({ key: groupKey, point: { x: e.clientX, y: e.clientY } }) : undefined}
                                style={{ left: typeLeft }}>
                                {/* Every row of the type SENT: the same full box as the status chips (5px margin,
                                    6px corners) in the Sent green (New Status 10). Otherwise plain text. */}
                                {allSent ? (
                                  <span className="absolute inset-[5px] flex items-center justify-center overflow-hidden rounded-[6px] px-2 text-[14px] font-semibold"
                                    style={{ background: 'var(--status-n10-bg)', color: 'var(--status-n10-fg)' }}>
                                    <span className="truncate">{group.type}</span>
                                  </span>
                                ) : group.type}
                                {(() => {
                                  const r = section.group != null ? groupRanks?.get(`${section.group}|${shown[0]?.projectId}|${group.type.toLowerCase()}`) : undefined;
                                  return r != null ? (
                                    <span className="absolute right-1 top-1 z-[1] rounded-[3px] bg-[#dc2626] px-1 text-[10px] font-semibold leading-4 text-white" title={`Rank ${r}`}>#{r}</span>
                                  ) : null;
                                })()}
                              </td>
                            );
                          }
                          if (col === 'poSignStatus') {
                            if (!isFirstOfGroup) return null;
                            // One PO cell for the whole type group, filled from top to bottom.
                            const ids = shown.map(i => i.id).filter(Boolean) as string[];
                            return (
                              <StatusCell key={col} rowSpan={group.items.length} opt={signStyle(po)} editable={canStatus && ids.length > 0}
                                onOpen={a => openMenu('po', ids, po, a)} />
                            );
                          }
                          if (col === 'orderType') return (
                            <td key={col} className={cn(TD, canRows && item.id && 'cursor-pointer hover:bg-ui-hover-bg')}
                              onClick={canRows && item.id ? e => setPicker({ kind: 'orderType', item, rect: e.currentTarget.getBoundingClientRect() }) : undefined}>
                              <OrderType value={item.orderType} />
                            </td>
                          );
                          if (col === 'vendor') return (
                            <td key={col} className={cn(TD, 'text-[13px] leading-[1.4]', canRows && item.id && 'cursor-pointer hover:bg-ui-hover-bg')}
                              onClick={canRows && item.id ? e => setPicker({ kind: 'vendor', item, rect: e.currentTarget.getBoundingClientRect() }) : undefined}>
                              {cellValue(col, item)}
                            </td>
                          );
                          if (col === 'pfSignStatus') return (
                            <StatusCell key={col} opt={signStyle(item.pfSignStatus)} editable={canStatus && !!item.id}
                              onOpen={a => openMenu('pf', [item.id!], normalizeSign(item.pfSignStatus), a)} />
                          );
                          if (col === 'status') return (
                            <StatusCell key={col} opt={statusStyle(item.status)} editable={canStatus && !!item.id}
                              onOpen={a => openMenu('status', [item.id!], normalizeStatus(item.status), a)} />
                          );
                          return (
                            <td key={col} className={cn(TD, col === 'pfCode' && 'text-[13px] leading-[1.4]', isMoneyColumn(col) && 'text-[var(--color-secondary-700)] dark:text-ui-heading')}>
                              {cellValue(col, item)}
                            </td>
                          );
                        })}
                        {payments && <PayCells item={item} edit={payEdit} onSaved={reload} />}
                      </tr>
                    );
                  });
                });
  
                return (
                  <Fragment key={`proj-${pi}`}>
                    <tr data-project-head={key} onContextMenu={e => openProjMenu(e, project, key)}>
                      <td colSpan={FROZEN} className={cn(FROZEN_TD, 'border-y border-ui-divider p-2')} style={barStyle}>
                        <button
                          type="button" onClick={() => toggle(key)} aria-expanded={!isCollapsed}
                          aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} project ${project.projectNo}`}
                          title={project.projectName || String(project.projectNo)}
                          className="flex w-full min-w-0 cursor-pointer items-center border-0 bg-transparent p-0 text-left text-inherit"
                        >
                          <Chevron size={24} aria-hidden className="shrink-0" />
                          {/* Name over address, as in the design ("STNE 440" / "Cherry Hill, 1849 …"). */}
                          <span className="flex min-w-0 flex-col pl-2 pr-1 leading-normal">
                            <span className="truncate text-[15px] font-medium">{headName(project)}</span>
                            {headAddress(project) && <span className="truncate text-[11px] font-normal">{headAddress(project)}</span>}
                          </span>
                        </button>
                      </td>
                      <td colSpan={cols.length - FROZEN} className="border-y border-ui-divider" style={barStyle} />
                      {payments && <PayHeadBand style={barStyle} />}
                    </tr>
                    {!isCollapsed && bodyRows}
                    {!isCollapsed && access.viewMoney && (
                      <tr>
                        {/* TOTAL runs the full width from the left edge, under the Project # box (Figma 741:16403). */}
                        <td colSpan={FROZEN} className={cn(FROZEN_TD, 'border-y border-ui-divider px-4 py-2.5 text-[14px] font-semibold')} style={barStyle}>TOTAL</td>
                        <td colSpan={moneyStart - FROZEN} className="border-y border-ui-divider" style={barStyle} />
                        {MONEY_COLS.map(col => (
                          <td key={col} className="border-y border-ui-divider px-2 py-2.5" style={barStyle}><MoneyChip col={col} value={totals[col] ?? 0} /></td>
                        ))}
                        <td colSpan={afterMoney} className="border-y border-ui-divider" style={barStyle} />
                        {payments && <PayTotalCells totals={payTotals(project.items || [])} styleOf={() => barStyle} />}
                      </tr>
                    )}
                  </Fragment>
                );
              });
  
              const secTotals: Partial<Record<ColumnKey, number>> = { pfUsd: secUsd, pfTl: secTl, invoice: secInv, invoiceTl: secInvTl };
              // A region folds like a project (same fold state); its totals row stays visible.
              const regionKey = `region:${section.label}`;
              const regionClosed = collapsed.has(regionKey);
              return (
                <Fragment key={`sec-${si}`}>
                  <tr>
                    <td colSpan={FROZEN} className="sticky left-0 z-[16] overflow-hidden border-y border-ui-divider p-2 text-[#EEF2F6]"
                      style={{ top: headH, background: section.group != null ? 'linear-gradient(90deg, #b91c1c, #ef4444)' : regionBg(section.label) }}>
                      <button
                        type="button" onClick={() => toggle(regionKey)} aria-expanded={!regionClosed}
                        aria-label={`${regionClosed ? 'Expand' : 'Collapse'} ${regionTitle(section.label)}`}
                        className="flex w-full min-w-0 cursor-pointer items-center whitespace-nowrap border-0 bg-transparent p-0 text-left text-inherit"
                      >
                        {regionClosed ? <ChevronRight size={24} aria-hidden className="shrink-0" /> : <ChevronDown size={24} aria-hidden className="shrink-0" />}
                        <span className={cn('truncate pl-2 pr-1 leading-normal', section.group != null ? 'text-[22px] font-bold text-white' : 'text-[16px] font-medium')}>{regionTitle(section.label)}</span>
                      </button>
                    </td>
                    <td colSpan={cols.length - FROZEN} className="sticky z-[15] border-y border-ui-divider"
                      style={{ top: headH, background: section.group != null ? 'linear-gradient(90deg, #b91c1c, #ef4444)' : regionBg(section.label) }} />
                    {payments && <PayBand top={headH} background={section.group != null ? 'linear-gradient(90deg, #b91c1c, #ef4444)' : regionBg(section.label)} />}
                  </tr>
                  {!regionClosed && projectRows}
                  {access.viewMoney && !payments && <tr>
                    <td colSpan={FROZEN} className={cn(FROZEN_TD, 'whitespace-nowrap px-4 py-2.5 text-[14px] font-semibold')} title={`${section.label.toUpperCase()} TOTALS`}
                      style={{ background: BOARD_CSS.sectionTotal.bg, color: BOARD_CSS.sectionTotal.fg }}>
                      {section.label.toUpperCase()} TOTALS
                    </td>
                    <td colSpan={moneyStart - FROZEN} style={{ background: BOARD_CSS.sectionTotal.bg }} />
                    {MONEY_COLS.map(col => (
                      <td key={col} className="px-2 py-2.5" style={{ background: BOARD_CSS.sectionTotal.bg }}><MoneyChip col={col} value={secTotals[col] ?? 0} /></td>
                    ))}
                    <td colSpan={afterMoney} style={{ background: BOARD_CSS.sectionTotal.bg }} />
                  </tr>}
                </Fragment>
              );
            })}
            {payments && access.viewMoney && (() => {
              const all = nonEmpty.flatMap(sec => sec.projects.flatMap(p => p.items || []));
              const grand: Partial<Record<ColumnKey, number>> = {};
              for (const it of all) for (const col of MONEY_COLS) grand[col] = (grand[col] ?? 0) + toNumber((it as Record<string, unknown>)[col] as number);
              const pink = PROJECT_CARD.head;
              return (
                <tr>
                  <td colSpan={FROZEN} className={cn(FROZEN_TD, 'whitespace-nowrap border-y border-l border-ui-divider px-4 py-2.5 text-[14px] font-semibold')} style={pink}>Project&apos;s Total</td>
                  <td colSpan={moneyStart - FROZEN} className="border-y border-ui-divider" style={pink} />
                  {MONEY_COLS.map(col => (
                    <td key={col} className="border-y border-ui-divider px-2 py-2.5" style={pink}><MoneyChip col={col} value={grand[col] ?? 0} /></td>
                  ))}
                  <td colSpan={afterMoney} className="border-y border-r border-ui-divider" style={pink} />
                  <PayTotalCells totals={payTotals(all)} labels styleOf={g => PAY_GROUPS.find(x => x.group === g)!.tone.head} />
                </tr>
              );
            })()}
          </tbody>
    );
    return { body, groupsByKey };
  }, [sections, pending, collapsed, colWidthKey, typeLeft, access, selection, groupRanks, payments, payEdit, reload, moneyStart, afterMoney]);

  // The board's own horizontal scrollbar sits at its bottom, often below the window. A second one
  // stays pinned to the bottom of the window (sticky) and scrolls the board with it.
  const boxRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const [bar, setBar] = useState({ scroll: 0, client: 0 });
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setBar(b => (b.scroll === box.scrollWidth && b.client === box.clientWidth ? b : { scroll: box.scrollWidth, client: box.clientWidth }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    if (box.firstElementChild) ro.observe(box.firstElementChild);
    return () => ro.disconnect();
  }, [nonEmpty.length]);
  const follow = (from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    if (!from || !to) return;
    if (syncing.current) { syncing.current = false; return; }
    if (to.scrollLeft !== from.scrollLeft) { syncing.current = true; to.scrollLeft = from.scrollLeft; }
  };

  if (!nonEmpty.length) {
    return (
      <EmptyState
        icon={<Factory />}
        title="No production rows yet"
        description="Projects with production items will appear here grouped by region."
      />
    );
  }

  return (
    <div className="relative">
    <div ref={boxRef} onScroll={() => follow(boxRef.current, barRef.current)}
      className={cn('overflow-auto', !payments && 'rounded-[8px] border border-ui-divider')} style={{ maxHeight: 'calc(100dvh - 220px)' }}>
      <table className="table-fixed border-separate border-spacing-0" style={{ width: `max(${cols.reduce((t, c) => t + width(c), 0) + payCols.reduce((t, c) => t + c.w, 0) + (payments ? PAY_GROUPS.length * GAP_W : 0)}px, 100%)` }}>
        <colgroup>
          {cols.map(c => <col key={c} style={{ width: width(c) }} />)}
          {payCols.map((c, i) => <Fragment key={c.key}>{startsGroup(i) && <col style={{ width: GAP_W }} />}<col style={{ width: c.w }} /></Fragment>)}
        </colgroup>
        <thead>
          {payments && (
            <tr>
              <th colSpan={FROZEN} aria-hidden className="sticky left-0 top-0 z-40 rounded-tl-[8px] border-y border-l border-ui-divider p-0"
                style={{ height: TITLE_H, ...PROJECT_CARD.title }} />
              <th colSpan={cols.length - FROZEN} className="sticky top-0 z-30 rounded-tr-[8px] border-y border-r border-ui-divider p-2 text-center text-[20px] font-semibold"
                style={{ height: TITLE_H, ...PROJECT_CARD.title }}>
                Project
              </th>
              {PAY_GROUPS.map(g => (
                <Fragment key={g.group}>
                  <Gap th />
                  <th colSpan={groupCols(g.group).length} className="sticky top-0 z-20 rounded-tl-[8px] rounded-tr-[8px] border border-ui-divider p-2 text-center text-[20px] font-semibold whitespace-nowrap"
                    style={{ height: TITLE_H, ...g.tone.title }}>
                    {g.title}
                  </th>
                </Fragment>
              ))}
            </tr>
          )}
          <tr>
            {cols.map(col => (
              <th key={col} className={cn('sticky z-20 whitespace-nowrap border-b border-r border-ui-divider px-2 text-left text-[12px] font-semibold leading-[1.4]',
                !payments && 'top-0 bg-ui-surface text-ui-body', col === 'projectNo' && 'left-0 z-30', col === 'type' && 'z-30', payments && col === 'projectNo' && 'border-l')}
                style={{ height: HEAD_H, top: payments ? TITLE_H : 0, ...(payments ? PROJECT_CARD.head : {}), ...(col === 'type' ? { left: typeLeft } : {}) }}>
                <ColumnResizer label={LABELS[col] ?? COLUMN_LABELS[col]} onResize={e => startResize(col, e)} onFit={() => fit(col)} />
                {LABELS[col] ?? COLUMN_LABELS[col]}
              </th>
            ))}
            {payments && PAY_COLS.map((c, i) => (
              <Fragment key={c.key}>
                {startsGroup(i) && <th aria-hidden className="sticky z-20 border-0 bg-ui-page-bg p-0" style={{ top: TITLE_H }} />}
                <th className={cn('sticky z-20 whitespace-nowrap border-b border-b-ui-divider px-3 text-left text-[12px] font-semibold leading-[1.4]', edge(i))}
                  style={{ top: TITLE_H, height: HEAD_H, ...PAY_GROUPS.find(g => g.group === c.group)!.tone.head }}>
                  {c.label}
                </th>
              </Fragment>
            ))}
          </tr>
        </thead>
        {body}
      </table>
      {menu && <StatusMenu menu={menu} onPick={v => void pick(v)} onClose={() => setMenu(null)} />}
      {picker?.kind === 'vendor' && (
        <VendorPicker rect={picker.rect} current={picker.item.vendorId ?? null} vendors={lists.vendors} onVendorsChanged={async () => { await lists.reloadVendors(); onSaved?.(); }}
          onClose={() => setPicker(null)} onPick={v => { const it = picker.item; setPicker(null); void pickVendor(it, v); }} />
      )}
      {picker?.kind === 'orderType' && (
        <OrderTypePicker rect={picker.rect} current={picker.item.orderType ?? null} options={lists.orderTypes} onAdded={() => void lists.reloadOrderTypes()}
          onClose={() => setPicker(null)} onClear={() => { const it = picker.item; setPicker(null); void pickOrderType(it, null); }}
          onPick={name => { const it = picker.item; setPicker(null); void pickOrderType(it, name); }} />
      )}
      {panel && groupsByKey.get(panel.key) && (() => {
        const g = groupsByKey.get(panel.key)!;
        const items: PanelItem[] = g.items.filter(i => i.id).map(i => ({ id: i.id!, pfCode: i.pfCode ?? null, vendorId: i.vendorId ?? null, orderType: i.orderType ?? null }));
        return (
          <EditItemPanel point={panel.point} type={g.type} items={items} vendors={lists.vendors} orderTypes={lists.orderTypes} canAdd={canRows}
            onSave={(id, patch) => patchItem(id, patch)} onAddItem={() => addItem(g)} onClose={() => setPanel(null)}
            onVendorsChanged={() => lists.reloadVendors()} onOrderTypesChanged={() => void lists.reloadOrderTypes()} />
        );
      })()}
      {projMenu && (
        <ProjectMenu key={projMenu.headKey} project={projMenu.project} headKey={projMenu.headKey} access={access}
          groups={groups} onGroupsChanged={() => onGroupsChanged?.()} onSaved={() => onSaved?.()}
          onDelete={() => setProjToDelete(projMenu.project)} onClose={() => setProjMenu(null)}
          onSelect={selection && projMenu.project.id ? () => selection.toggle(projMenu.project.id!) : undefined}
          selected={!!projMenu.project.id && !!selection?.selected.has(projMenu.project.id)} />
      )}
      <ConfirmModal
        open={!!projToDelete} onOpenChange={o => { if (!o) setProjToDelete(null); }}
        title="Delete this project?" tone="destructive" confirmLabel="Delete Project"
        description={projToDelete ? `Are you sure you want to delete the project "${projToDelete.editName || projToDelete.projectNo}"?` : undefined}
        warning="It goes to the trash and can be restored from there."
        onConfirm={async () => { if (projToDelete) await deleteProject(projToDelete); setProjToDelete(null); }}
      />
      {rowMenu && (
        <RowMenu point={rowMenu.point} title={rowMenu.item.type ?? 'Row'} onClose={() => setRowMenu(null)}
          onDelete={() => { const it = rowMenu.item; setRowMenu(null); setToDelete(it); }} />
      )}
      <ConfirmModal
        open={!!toDelete} onOpenChange={o => { if (!o) setToDelete(null); }}
        title="Delete this row?" tone="destructive" confirmLabel="Delete Row"
        description={toDelete ? [toDelete.type, toDelete.pfCode, vendorText(toDelete.vendor)].filter(Boolean).join(' · ') : undefined}
        warning={toDelete && (toDelete.pfCode || toDelete.vendorId) ? 'This row has a vendor or PF code. It goes to the trash and can be restored from there.' : undefined}
        onConfirm={async () => { if (toDelete) await deleteItem(toDelete); setToDelete(null); }}
      />
    </div>
      {bar.scroll > bar.client + 1 && (
        <div ref={barRef} aria-hidden onScroll={() => follow(barRef.current, boxRef.current)}
          className="sticky bottom-0 z-40 overflow-x-auto overflow-y-hidden border-t border-ui-divider bg-ui-page-bg" style={{ height: 16 }}>
          <div style={{ width: bar.scroll, height: 1 }} />
        </div>
      )}
    </div>
  );
}
