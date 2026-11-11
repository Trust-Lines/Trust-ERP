'use client';

import '@/modules/trust-projects/isolation.css';
import '@/modules/trust-projects/styles.scoped.css';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStatusStyle } from '@/modules/trust-projects/utils/statusStyles';
import { CellStatusAutocomplete, CellVendorAutocomplete, DateEditor, PfSignStatusEditor, SelectEditor, TextEditor } from '@/modules/trust-projects/components/InlineEditors';
import type { TrustStock, TrustStockItem } from './types';
import { fmtDay, stockTile, sum, tl, usd, type AmountKey } from './store';
import { ColumnResizer, useColumnWidths } from '@/components/ui/column-resize';
import { getVendors, type Vendor } from './pfImport';

// Trust Stock as an Excel sheet: Projects (the PF lines) and Accounting (their payments), one or
// both side by side with their rows lined up. Every cell edits in place with the same editors as
// the Projects board (status / PF sign / vendor lists, date and text inputs). Column widths fit
// the widest text by themselves; drag a column's right edge to resize it, double-click the edge
// to fit it again. Widths are remembered in this browser.

const H_ROW = 52;
const H_TOTAL = 44;
const GROUP_BAR = 'bg-[#848484]';
const TILE = ['#9ecf67', '#e0813e'];
const USD_FG = 'var(--status-t6-fg)';
const TL_FG = 'var(--status-t8-fg)';
const TH = 'relative px-2 text-left text-[12px] font-semibold leading-[1.3] text-[var(--status-t0-fg)]';
const V = 'border-r border-ui-divider';
const TYPES = ['Millwork', 'Shelving', 'Ceiling', 'Image', 'Furniture', 'Decoration'];
const TYPE_BG: Record<string, string> = {
  Millwork: '#167e3f', Shelving: '#0f766e', Ceiling: '#2366b2', Image: '#b45309', Furniture: '#74489d', Decoration: '#be185d',
};
const STATUS_LABEL: Record<string, string> = { HOLD_T: 'HOLD / T', HOLD_PM: 'HOLD / PM' };
export const statusLabel = (s: string) => STATUS_LABEL[s] ?? s.replace(/_/g, ' ');
const today = () => new Date().toISOString().slice(0, 10);

// ── Small pieces ─────────────────────────────────────────────────────────────────────────────
function Chip({ children, style, className }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return <span className={cn('inline-flex max-w-full items-center justify-center truncate whitespace-nowrap rounded-[4px] px-2.5 py-1.5 text-[12px] font-medium leading-4', className)} style={style}>{children}</span>;
}
function Money({ value, cur }: { value: number; cur: 'usd' | 'tl' }) {
  return <span style={{ color: cur === 'usd' ? USD_FG : TL_FG }}>{cur === 'usd' ? usd(value) : tl(value)}</span>;
}
function TotalChip({ value, cur }: { value: number; cur: 'usd' | 'tl' }) {
  return (
    <span className="flex w-full items-center justify-end whitespace-nowrap rounded-[4px] bg-ui-page-bg py-1 pl-2 pr-2 text-[12px] font-medium tabular-nums leading-4" style={{ color: cur === 'usd' ? USD_FG : TL_FG }}>
      {cur === 'usd' ? usd(value) : tl(value)}
    </span>
  );
}
const statusChip = (s: string) => { const st = getStatusStyle(s); return { background: st.backgroundColor, color: st.color }; };

// ── Columns ──────────────────────────────────────────────────────────────────────────────────
type EditKind = 'text' | 'number' | 'date' | 'type' | 'vendor' | 'pfSign' | 'status';
interface Col {
  id: string;
  label: string;
  /** Plain text of a cell, for fitting the width. */
  text: (i: TrustStockItem) => string;
  render: (i: TrustStockItem) => ReactNode;
  edit?: { kind: EditKind; get: (i: TrustStockItem) => string; set: (v: string, i: TrustStockItem) => Partial<TrustStockItem> };
  money?: AmountKey;
  cur?: 'usd' | 'tl';
  chip?: boolean;
  min?: number;
}

const num = (v: string) => { const n = Number(v.replace(/[^\d.,-]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const moneyText = (n: number, cur: 'usd' | 'tl') => (cur === 'usd' ? usd(n) : tl(n));

function moneyCol(id: string, label: string, key: AmountKey, cur: 'usd' | 'tl', editable = true): Col {
  const field = key as keyof TrustStockItem;
  return {
    id, label, money: key, cur,
    text: i => moneyText(sum([i], key), cur),
    render: i => <Money value={sum([i], key)} cur={cur} />,
    edit: editable ? { kind: 'number', get: i => String(i[field] ?? 0), set: v => ({ [field]: num(v) }) as Partial<TrustStockItem> } : undefined,
  };
}
function dateCol(id: string, label: string, field: keyof TrustStockItem): Col {
  return {
    id, label,
    text: i => fmtDay((i[field] as string | null) ?? null),
    render: i => fmtDay((i[field] as string | null) ?? null),
    edit: { kind: 'date', get: i => (i[field] as string | null) ?? '', set: v => ({ [field]: v || null }) as Partial<TrustStockItem> },
  };
}

const PROJECT_COLS: Col[] = [
  { id: 'type', label: 'Type', chip: true, text: i => i.type, render: i => <Chip className="text-[13px] font-semibold text-white" style={{ background: TYPE_BG[i.type] ?? '#787881' }}>{i.type}</Chip>, edit: { kind: 'type', get: i => i.type, set: v => ({ type: v }) } },
  { id: 'pfCode', label: 'PF Code', text: i => i.pfCode, render: i => i.pfCode || '—', edit: { kind: 'text', get: i => i.pfCode, set: v => ({ pfCode: v.trim() }) } },
  { id: 'vendor', label: 'Vendor', text: i => i.vendor, render: i => i.vendor || '—', edit: { kind: 'vendor', get: i => i.vendor, set: v => ({ vendor: v }) } },
  { id: 'orderNo', label: 'Order#', text: i => i.orderNo, render: i => i.orderNo || '—', edit: { kind: 'text', get: i => i.orderNo, set: v => ({ orderNo: v.trim() }) } },
  { id: 'pfSign', label: 'PF Sign Status', chip: true, text: i => i.pfSign, render: i => <Chip style={statusChip(i.pfSign)}>{i.pfSign}</Chip>, edit: { kind: 'pfSign', get: i => i.pfSign, set: v => ({ pfSign: v }) } },
  {
    id: 'status', label: 'Status', chip: true, text: i => statusLabel(i.status), render: i => <Chip style={statusChip(i.status)}>{statusLabel(i.status)}</Chip>,
    // Like the Trust System: ORDERED puts today in STD when it's empty.
    edit: { kind: 'status', get: i => i.status, set: (v, i) => ({ status: v, ...(v === 'ORDERED' && !i.std ? { std: today() } : {}) }) },
  },
  dateCol('std', 'STD', 'std'), dateCol('rtr', 'RTR', 'rtr'), dateCol('rto', 'RTO', 'rto'),
  moneyCol('pfUsd', 'PF/USD', 'pfUsd', 'usd'), moneyCol('pfTl', 'PF/TL', 'pfTl', 'tl'),
  moneyCol('invUsd', 'INV/USD', 'invUsd', 'usd'), moneyCol('invTl', 'INV/TL', 'invTl', 'tl'),
  {
    id: 'paymentRule', label: 'Payment Rule', text: i => (i.paymentRule != null ? `${i.paymentRule} %` : '—'), render: i => (i.paymentRule != null ? `${i.paymentRule} %` : '—'),
    edit: { kind: 'number', get: i => (i.paymentRule != null ? String(i.paymentRule) : ''), set: v => ({ paymentRule: v.trim() === '' ? null : num(v) }) },
  },
];

// Two header rows, two colours: the group row (1st USD … Invoice) in the sheet's own tone, the
// column row (Paid/USD, Date, USD, TL …) in the grey every sheet uses — so the rows read apart.
type Group = { label: string; span: number };
const ACC_GROUPS: Group[] = [
  { label: '1st USD', span: 2 }, { label: '2nd USD', span: 2 }, { label: '1st TL', span: 2 }, { label: '2nd TL', span: 2 },
  { label: 'Remaining', span: 2 }, { label: 'Not Ordered', span: 2 }, { label: 'Invoice', span: 2 },
];
/** A group's first column gets a stronger left edge, in the header and down the rows. */
const GROUP_EDGE = 'border-l-2 border-l-[var(--status-t0-fg)]/40';
const ACC_COLS: Col[] = [
  moneyCol('paid1Usd', 'Paid/USD', 'paid1Usd', 'usd'), dateCol('paid1UsdDate', 'Date', 'paid1UsdDate'),
  moneyCol('paid2Usd', 'Paid/USD', 'paid2Usd', 'usd'), dateCol('paid2UsdDate', 'Date', 'paid2UsdDate'),
  moneyCol('paid1Tl', 'Paid/TL', 'paid1Tl', 'tl'), dateCol('paid1TlDate', 'Date', 'paid1TlDate'),
  moneyCol('paid2Tl', 'Paid/TL', 'paid2Tl', 'tl'), dateCol('paid2TlDate', 'Date', 'paid2TlDate'),
  moneyCol('remainingUsd', 'USD', 'remainingUsd', 'usd', false), moneyCol('remainingTl', 'TL', 'remainingTl', 'tl', false),
  moneyCol('notOrderedUsd', 'USD', 'notOrderedUsd', 'usd'), moneyCol('notOrderedTl', 'TL', 'notOrderedTl', 'tl'),
  moneyCol('invUsdAcc', 'USD', 'invUsd', 'usd'), moneyCol('invTlAcc', 'TL', 'invTl', 'tl'),
];

// ── Widths: components/ui/column-resize (fit the widest text; drag to resize; double-click to fit) ──

// ── Editable cell ────────────────────────────────────────────────────────────────────────────
function EditableCell({ col, item, stockId, editing, setEditing, onPatch, vendors, className }: {
  col: Col; item: TrustStockItem; stockId: string; className?: string;
  editing: boolean; setEditing: (on: boolean) => void;
  onPatch: (patch: Partial<TrustStockItem>) => void;
  vendors: Vendor[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const align = col.money || col.id === 'paymentRule' ? 'text-right tabular-nums' : '';
  const close = () => setEditing(false);
  const save = (v: string) => { if (col.edit && v !== col.edit.get(item)) onPatch(col.edit.set(v, item)); close(); };

  let editor: ReactNode = null;
  if (editing && col.edit) {
    const value = col.edit.get(item);
    switch (col.edit.kind) {
      case 'text': case 'number': editor = <TextEditor value={value} onSave={save} onCancel={close} />; break;
      case 'date': editor = <DateEditor value={value} onSave={save} onCancel={close} />; break;
      case 'type': editor = <SelectEditor value={value} options={TYPES} onSave={save} onCancel={close} />; break;
      case 'pfSign': editor = <PfSignStatusEditor value={value} onSave={save} onCancel={close} triggerRef={ref} />; break;
      case 'status': editor = <CellStatusAutocomplete value={value} onSave={save} onCancel={close} triggerRef={ref} itemId={item.id} projectId={stockId} />; break;
      case 'vendor': editor = (
        <CellVendorAutocomplete
          value={value} triggerRef={ref} itemId={item.id} projectId={stockId} onCancel={close}
          onSave={id => { const v = vendors.find(x => x.id === id); save(v ? `${v.code} - ${v.name}` : value); }}
        />
      ); break;
    }
  }

  return (
    <td
      className={cn('overflow-hidden px-2 text-[13px] text-ui-body', V, align, col.edit && !editing && 'cursor-cell hover:bg-ui-hover-bg', className)}
      onClick={() => { if (col.edit && !editing) setEditing(true); }}
      onKeyDown={e => { if (col.edit && !editing && (e.key === 'Enter' || e.key === 'F2')) { e.preventDefault(); setEditing(true); } }}
      tabIndex={col.edit ? 0 : undefined}
      aria-label={col.edit ? `${col.label}: ${col.text(item) || 'empty'} — edit` : undefined}
    >
      {editor
        ? <div ref={ref} className="trust-projects w-full">{editor}</div>
        : <div ref={ref} className="truncate whitespace-nowrap">{col.render(item)}</div>}
    </td>
  );
}

// ── One sheet ────────────────────────────────────────────────────────────────────────────────
function Sheet({ storageKey, title, tone, cols, groups, stocks, allItems, showTile, onPatch, onRemove, vendors, grandLabel }: {
  storageKey: string; title: string; tone: 't10' | 't7';
  cols: Col[]; groups?: Group[];
  stocks: TrustStock[]; allItems: TrustStockItem[];
  showTile: boolean;
  onPatch: (stockId: string, item: TrustStockItem, patch: Partial<TrustStockItem>) => void;
  onRemove?: (stockId: string, item: TrustStockItem) => void;
  vendors: Vendor[];
  grandLabel: string;
}) {
  const tileCol = useMemo(() => ({ id: 'stock', label: 'Project#', text: () => '', min: 96 }), []);
  const sizing = useMemo(() => [...(showTile ? [tileCol] : []), ...cols], [showTile, tileCol, cols]);
  const { width, startResize, fit } = useColumnWidths(storageKey, sizing, allItems);
  const [editing, setEditing] = useState<string | null>(null); // `${itemId}:${colId}`
  const firstMoney = cols.findIndex(c => c.money);
  const total = sizing.reduce((t, c) => t + width(c.id), 0) + (onRemove ? 36 : 0);
  const headH = groups ? 34 : 68;
  // Column index → whether it starts a group.
  const colGroup = (groups ?? []).flatMap(g => Array.from({ length: g.span }, (_, k) => ({ first: k === 0 })));
  const edge = (ci: number) => (colGroup[ci]?.first && ci > 0 ? GROUP_EDGE : undefined);
  const leafHead = (c: Col | typeof tileCol, rowSpan?: number, ci = -1) => (
    <th
      key={c.id} rowSpan={rowSpan} scope="col" className={cn(TH, V, 'money' in c && c.money && 'text-right', edge(ci))}
      style={{ height: headH }}
    >
      <span className="block truncate">{c.label}</span>
      <ColumnResizer label={c.label} onResize={e => startResize(c.id, e)} onFit={() => fit(c.id)} />
    </th>
  );

  return (
    <section aria-label={title} className="overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg" style={{ width: total }}>
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          {sizing.map(c => <col key={c.id} style={{ width: width(c.id) }} />)}
          {onRemove && <col style={{ width: 36 }} />}
        </colgroup>
        <thead>
          <tr className="h-[52px]" style={{ background: `var(--status-${tone}-bg)` }}>
            <th colSpan={sizing.length + (onRemove ? 1 : 0)} scope="colgroup" className="text-center text-[20px] font-semibold" style={{ color: `var(--status-${tone}-fg)` }}>{title}</th>
          </tr>
          {groups ? (
            <>
              <tr className="border-b border-ui-divider" style={{ background: 'var(--status-t0-bg)' }}>
                {showTile && leafHead(tileCol, 2)}
                {groups.map((g, gi) => (
                  <th
                    key={g.label} colSpan={g.span} scope="colgroup" className={cn(TH, V, 'text-center text-[13px] font-bold', gi > 0 && GROUP_EDGE)}
                    style={{ height: headH, background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}
                  >
                    {g.label}
                  </th>
                ))}
                {onRemove && <th rowSpan={2} aria-hidden />}
              </tr>
              <tr className="border-b border-ui-divider" style={{ background: 'var(--status-t0-bg)' }}>{cols.map((c, ci) => leafHead(c, undefined, ci))}</tr>
            </>
          ) : (
            <tr className="border-b border-ui-divider" style={{ background: 'var(--status-t0-bg)' }}>
              {showTile && leafHead(tileCol)}
              {cols.map(c => leafHead(c))}
              {onRemove && <th aria-hidden />}
            </tr>
          )}
        </thead>
        {stocks.map((s, gi) => {
          const t = stockTile(s.code);
          const tile = (span: number) => showTile && (
            <th rowSpan={span} scope="rowgroup" className={cn('px-2 text-center align-middle text-[20px] font-medium leading-tight text-white', V)} style={{ background: TILE[gi % TILE.length] }}>
              {t.head}<br />{t.rest}
            </th>
          );
          return (
            <tbody key={s.id}>
              {s.items.length === 0 ? (
                <tr className="border-b border-ui-divider" style={{ height: H_ROW }}>
                  {tile(2)}
                  <td colSpan={cols.length + (onRemove ? 1 : 0)} className="px-4 text-[12px] text-ui-text-secondary">No lines yet — upload a PF PDF.</td>
                </tr>
              ) : s.items.map((i, ri) => (
                <tr key={i.id} className="group border-b border-ui-divider" style={{ height: H_ROW }}>
                  {ri === 0 && tile(s.items.length + 1)}
                  {cols.map((c, ci) => {
                    const key = `${i.id}:${c.id}`;
                    return (
                      <EditableCell
                        key={c.id} col={c} item={i} stockId={s.id} vendors={vendors} className={edge(ci)}
                        editing={editing === key} setEditing={on => setEditing(on ? key : null)}
                        onPatch={patch => onPatch(s.id, i, patch)}
                      />
                    );
                  })}
                  {onRemove && (
                    <td className="px-1 text-center">
                      <button
                        type="button" aria-label={`Remove ${i.pfCode || 'line'}`} title="Remove line"
                        onClick={() => { if (window.confirm(`Remove ${i.pfCode || 'this line'} from ${s.code}?`)) onRemove(s.id, i); }}
                        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-[4px] border-0 bg-transparent text-ui-text-secondary opacity-0 transition-opacity hover:bg-ui-hover-bg hover:text-error-normal focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              <tr className={GROUP_BAR} style={{ height: H_TOTAL }}>
                {firstMoney > 0 && <td colSpan={firstMoney} className="border-r border-white/30 px-4 text-[14px] font-semibold text-[#eef2f6]">TOTAL</td>}
                {cols.map((c, ci) => (ci < firstMoney ? null : (
                  <td key={c.id} className={cn('border-r border-white/30 px-2', ci === 0 && 'text-[14px] font-semibold text-[#eef2f6]', edge(ci))}>
                    {c.money ? <TotalChip value={sum(s.items, c.money)} cur={c.cur!} /> : ci === 0 ? 'TOTAL' : null}
                  </td>
                )))}
                {onRemove && <td />}
              </tr>
            </tbody>
          );
        })}
        <tfoot>
          <tr className="h-[52px]" style={{ background: `var(--status-${tone}-bg)` }}>
            {(showTile || firstMoney > 0) && (
              <td colSpan={(showTile ? 1 : 0) + Math.max(0, firstMoney)} className={cn('px-4 text-[14px] font-semibold', V)} style={{ color: `var(--status-${tone}-fg)` }}>{grandLabel}</td>
            )}
            {cols.map((c, ci) => (ci < firstMoney ? null : (
              <td key={c.id} className={cn('px-2', V, edge(ci))}>
                {c.money ? <TotalChip value={sum(allItems, c.money)} cur={c.cur!} /> : null}
              </td>
            )))}
            {onRemove && <td />}
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

export function StockGrid({ stocks, allItems, shown, onPatch, onRemove }: {
  stocks: TrustStock[];
  allItems: TrustStockItem[];
  shown: { projects: boolean; accounting: boolean };
  onPatch: (stockId: string, item: TrustStockItem, patch: Partial<TrustStockItem>) => void;
  onRemove: (stockId: string, item: TrustStockItem) => void;
}) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  useEffect(() => { getVendors().then(setVendors).catch(() => {}); }, []);
  return (
    <div className="flex min-w-max items-start gap-8">
      {shown.projects && (
        <Sheet
          storageKey="trust-stock-widths-projects" title="Trust Stock" tone="t10" cols={PROJECT_COLS}
          stocks={stocks} allItems={allItems} showTile onPatch={onPatch} onRemove={onRemove} vendors={vendors} grandLabel="Trust Stock’s Total"
        />
      )}
      {shown.accounting && (
        <Sheet
          storageKey="trust-stock-widths-accounting" title="Accounting Trust Stock" tone="t7" cols={ACC_COLS} groups={ACC_GROUPS}
          // Project# only when Accounting stands alone — side by side, the Projects sheet shows it.
          stocks={stocks} allItems={allItems} showTile={!shown.projects} onPatch={onPatch} vendors={vendors} grandLabel="Accounting Grand Total"
        />
      )}
    </div>
  );
}

