'use client';

import { useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Boxes, Plus, Rows3, Search, Upload } from 'lucide-react';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { TrustStock, TrustStockItem } from './types';
import { fmtDay, sum, tl, usd, useTrustStocks, type AmountKey } from './store';
import { NewStockDialog, PF_SIGN, SEND_STATUS, StockItemDialog } from './TrustStockForms';
import { StockOverview } from './StockOverview';

// Figma "Trust Stock" (node 598:22796): two tables side by side that share their rows — the
// stock lines (PF, vendor, dates, PF/INV amounts) and the accounting for the same lines
// (payments, remaining, not ordered, invoice). Each stock batch is a coloured block with a
// total row; grand totals sit at the bottom. Frontend only: no Trust Stock backend yet.
// Internal only — PF and vendor prices must never reach tlines_pm (the page enforces it).

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
// Row heights are shared by both tables so their rows line up.
const H_BAR = 'h-[51px]';
const H_ROW = 'h-[52px]';
const H_TOTAL = 'h-[44px]';
const GROUP_BAR = 'bg-[#848484]';
const TILE = ['#9ecf67', '#e0813e'];
const USD_FG = 'var(--status-t6-fg)';
const TL_FG = 'var(--status-t8-fg)';
const CELL = 'px-2 text-[12px] whitespace-nowrap text-ui-body';
const TH = 'px-2 text-left text-[12px] font-semibold leading-[1.4] whitespace-nowrap text-[var(--status-t0-fg)]';

const TYPE_BG: Record<string, string> = {
  Millwork: '#167e3f', Ceiling: '#2366b2', Lighting: '#b34819', Furniture: '#74489d',
};
const SIGN_STYLE: Record<TrustStockItem['pfSign'], CSSProperties> = {
  signed: { background: '#92d050', color: '#000' },
  pending: { background: 'var(--status-t7-bg)', color: 'var(--status-t7-fg)' },
  not_signed: { background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' },
};
const STATUS_STYLE: Record<TrustStockItem['status'], CSSProperties> = {
  sent: { background: '#157f3f', color: '#fff' },
  not_sent: { background: 'var(--status-t0-bg)', color: 'var(--status-t0-fg)' },
};
const label = <T extends string>(list: { value: T; label: string }[], v: T) => list.find(o => o.value === v)?.label ?? v;

function Chip({ children, style, className }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <span className={cn('inline-flex items-center justify-center whitespace-nowrap rounded-[4px] py-2 pl-2.5 pr-2 text-[12px] font-medium leading-4', className)} style={style}>
      {children}
    </span>
  );
}

function Money({ value, cur }: { value: number; cur: 'usd' | 'tl' }) {
  return <span style={{ color: cur === 'usd' ? USD_FG : TL_FG }}>{cur === 'usd' ? usd(value) : tl(value)}</span>;
}

/** White total chip (Figma "Project stage" in the TOTAL rows). */
function TotalChip({ value, cur, prefix }: { value: number; cur: 'usd' | 'tl'; prefix?: string }) {
  return (
    <span className="inline-flex min-w-[70px] items-center justify-center whitespace-nowrap rounded-[4px] bg-ui-page-bg py-1 pl-2.5 pr-2 text-[12px] font-medium leading-4" style={{ color: cur === 'usd' ? USD_FG : TL_FG }}>
      {prefix ? `${prefix} ` : ''}{cur === 'usd' ? usd(value) : tl(value)}
    </span>
  );
}

function rowKeys(open: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: open,
    onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } },
  };
}

export function TrustStockClient() {
  const { stocks, addStock, saveItem, removeItem } = useTrustStocks();
  const [query, setQuery] = useState('');
  const [newStock, setNewStock] = useState(false);
  const [overview, setOverview] = useState(false);
  const [editing, setEditing] = useState<{ stockId: string; item: TrustStockItem | null } | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stocks;
    return stocks
      .map(s => `stock ${s.code}`.toLowerCase().includes(q) ? s : {
        ...s,
        items: s.items.filter(i => `${i.type} ${i.pfCode} ${i.vendor} ${i.orderNo}`.toLowerCase().includes(q)),
      })
      .filter(s => s.items.length > 0 || `stock ${s.code}`.toLowerCase().includes(q));
  }, [stocks, query]);

  const allItems = useMemo(() => visible.flatMap(s => s.items), [visible]);
  const editingStock = editing ? stocks.find(s => s.id === editing.stockId) : null;
  const openItem = (stockId: string, item: TrustStockItem | null) => setEditing({ stockId, item });

  return (
    <div className="flex flex-col gap-[30px]">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'Operations' }, { label: 'Trust Stock', href: '/trust-stock' }]} />
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Trust Stock</h1>
        <p className="m-0 text-[13px] text-ui-body">
          {stocks.length} stock{stocks.length === 1 ? '' : 's'} · {stocks.reduce((n, s) => n + s.items.length, 0)} line{stocks.reduce((n, s) => n + s.items.length, 0) === 1 ? '' : 's'}
        </p>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-[285px] max-w-full">
          <Search size={16} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
          <input
            type="search" aria-label="Search stock" placeholder="Search project…"
            value={query} onChange={e => setQuery(e.target.value)}
            className="h-9 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-2.5 text-[13px] leading-[1.45] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
          />
        </div>
        <div className="flex items-center gap-2">
          {/* Figma toolbar (node 598:22871): Upload PF PDF (outline), Stock Contents (primary), New Stock (accent).
              Upload needs PF parsing + Dropbox upload on the server; not built yet. */}
          <button
            type="button" disabled title="PF upload isn't connected yet"
            className={cn('inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-[6px] border border-[var(--color-secondary-700)] bg-transparent pl-4 pr-5 text-[13px] font-medium leading-[1.35] opacity-50 dark:border-ui-heading', HEADING)}
          >
            <Upload size={16} aria-hidden /> Upload PF PDF
          </button>
          <button
            type="button" onClick={() => setOverview(true)}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[6px] border-0 bg-[var(--color-secondary-700)] pl-4 pr-5 text-[13px] font-medium leading-[1.35] text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring dark:bg-primary-50 dark:text-primary-950"
          >
            <Rows3 size={16} aria-hidden /> Stock Contents
          </button>
          <button
            type="button" onClick={() => setNewStock(true)}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[6px] border-0 bg-ui-btn-accent pl-6 pr-8 text-[13px] font-medium leading-[1.35] text-ui-btn-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring"
          >
            <Plus size={16} aria-hidden /> New Stock
          </button>
        </div>
      </div>

      {stocks.length === 0 ? (
        <EmptyState
          boxed icon={<Boxes />} title="No stock yet"
          description="Create a stock batch, then add its PF lines to track payments and invoices."
          action={<button type="button" onClick={() => setNewStock(true)} className="inline-flex h-9 items-center gap-2 rounded-[6px] border-0 bg-ui-btn-accent px-5 text-[13px] font-medium text-ui-btn-accent-fg hover:opacity-90"><Plus size={16} aria-hidden /> New Stock</button>}
        />
      ) : visible.length === 0 ? (
        <EmptyState boxed icon={<Search />} title="No matching stock" description="Try another PF code, vendor, order or stock code." />
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max items-start gap-8">
            <StockTable stocks={visible} allItems={allItems} onOpen={openItem} />
            <AccountingTable stocks={visible} allItems={allItems} onOpen={openItem} />
          </div>
        </div>
      )}

      <StockOverview open={overview} onOpenChange={setOverview} stocks={stocks} />
      <NewStockDialog open={newStock} onOpenChange={setNewStock} existing={stocks.map(s => s.code)} onCreate={addStock} />
      <StockItemDialog
        open={!!editing && !!editingStock}
        onOpenChange={o => { if (!o) setEditing(null); }}
        stockCode={editingStock?.code ?? ''}
        item={editing?.item ?? null}
        onSave={item => editing && saveItem(editing.stockId, item)}
        onRemove={id => editing && removeItem(editing.stockId, id)}
      />
    </div>
  );
}

type OpenItem = (stockId: string, item: TrustStockItem | null) => void;

// ── Trust Stock (left) ─────────────────────────────────────────────────────────────────────
const LEFT_COLS: { label: string; w: number }[] = [
  { label: 'Project#', w: 118 }, { label: 'Type', w: 124 }, { label: 'PF Code', w: 125 }, { label: 'Vendor', w: 231 },
  { label: 'Order#', w: 125 }, { label: 'PF Sign Status', w: 120 }, { label: 'Status', w: 127 }, { label: 'STD', w: 109 },
  { label: 'RTR', w: 106 }, { label: 'RTO', w: 124 }, { label: 'PF/USD', w: 100 }, { label: 'PF/TL', w: 103 },
  { label: 'INV/USD', w: 100 }, { label: 'INV/TL', w: 118 }, { label: 'Payment Rule', w: 110 },
];

function StockTable({ stocks, allItems, onOpen }: { stocks: TrustStock[]; allItems: TrustStockItem[]; onOpen: OpenItem }) {
  const width = LEFT_COLS.reduce((t, c) => t + c.w, 0);
  return (
    <section aria-label="Trust Stock" className="overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg" style={{ width }}>
      <table className="w-full table-fixed border-collapse">
        <colgroup>{LEFT_COLS.map(c => <col key={c.label} style={{ width: c.w }} />)}</colgroup>
        <thead>
          <tr className="h-[52px]" style={{ background: 'var(--status-t10-bg)' }}>
            <th colSpan={LEFT_COLS.length} scope="colgroup" className="text-center text-[20px] font-semibold" style={{ color: 'var(--status-t10-fg)' }}>Trust Stock</th>
          </tr>
          <tr className="h-[46px] border-b border-ui-divider" style={{ background: 'var(--status-t0-bg)' }}>
            {LEFT_COLS.map(c => <th key={c.label} scope="col" className={TH}>{c.label}</th>)}
          </tr>
        </thead>
        {stocks.map((s, gi) => {
          const span = 2 + Math.max(1, s.items.length);
          return (
            <tbody key={s.id}>
              <tr className={cn(H_BAR, GROUP_BAR, 'border-b border-ui-divider')}>
                <th
                  rowSpan={span} scope="rowgroup"
                  className="border-r border-ui-divider px-2.5 text-center align-middle text-[24px] font-medium leading-tight text-white"
                  style={{ background: TILE[gi % TILE.length] }}
                >
                  STOCK<br />{s.code}
                </th>
                <td colSpan={LEFT_COLS.length - 1} className="px-3 text-right">
                  <button
                    type="button" onClick={() => onOpen(s.id, null)}
                    className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-[4px] border-0 bg-white/90 px-2.5 text-[12px] font-medium text-[#3d3d43] hover:bg-white"
                  >
                    <Plus size={14} aria-hidden /> Add line
                  </button>
                </td>
              </tr>
              {s.items.length === 0 ? (
                <tr className={cn(H_ROW, 'border-b border-ui-divider')}>
                  <td colSpan={LEFT_COLS.length - 1} className="px-4 text-[12px] text-ui-text-secondary">No lines yet.</td>
                </tr>
              ) : s.items.map(i => (
                <tr key={i.id} {...rowKeys(() => onOpen(s.id, i))} aria-label={`Edit ${i.pfCode}`} className={cn(H_ROW, 'cursor-pointer border-b border-ui-divider hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ui-focus-ring')}>
                  <td className="px-2"><Chip className="text-[14px] font-semibold text-white" style={{ background: TYPE_BG[i.type] ?? '#787881' }}>{i.type}</Chip></td>
                  <td className={cn(CELL, 'truncate text-[13px]')} title={i.pfCode}>{i.pfCode}</td>
                  <td className={cn(CELL, 'truncate text-[13px]')} title={i.vendor}>{i.vendor || '—'}</td>
                  <td className={cn(CELL, 'truncate text-[13px]')} title={i.orderNo}>{i.orderNo || '—'}</td>
                  <td className="px-2"><Chip className="w-[81px]" style={SIGN_STYLE[i.pfSign]}>{label(PF_SIGN, i.pfSign)}</Chip></td>
                  <td className="px-2"><Chip className="min-w-[80px]" style={STATUS_STYLE[i.status]}>{label(SEND_STATUS, i.status)}</Chip></td>
                  <td className={CELL}>{fmtDay(i.std)}</td>
                  <td className={CELL}>{fmtDay(i.rtr)}</td>
                  <td className={CELL}>{fmtDay(i.rto)}</td>
                  <td className={CELL}><Money value={i.pfUsd} cur="usd" /></td>
                  <td className={CELL}><Money value={i.pfTl} cur="tl" /></td>
                  <td className={CELL}><Money value={i.invUsd} cur="usd" /></td>
                  <td className={CELL}><Money value={i.invTl} cur="tl" /></td>
                  <td className={CELL}>{i.paymentRule != null ? `${i.paymentRule} %` : '—'}</td>
                </tr>
              ))}
              <tr className={cn(H_TOTAL, GROUP_BAR)}>
                <td colSpan={9} className="px-4 text-[14px] font-semibold text-[#eef2f6]">TOTAL</td>
                <td className="px-2"><TotalChip value={sum(s.items, 'pfUsd')} cur="usd" /></td>
                <td className="px-2"><TotalChip value={sum(s.items, 'pfTl')} cur="tl" /></td>
                <td className="px-2"><TotalChip value={sum(s.items, 'invUsd')} cur="usd" /></td>
                <td className="px-2"><TotalChip value={sum(s.items, 'invTl')} cur="tl" /></td>
                <td />
              </tr>
            </tbody>
          );
        })}
        <tfoot>
          <tr className="h-[52px]" style={{ background: 'var(--status-t10-bg)' }}>
            <td colSpan={LEFT_COLS.length} className="px-6">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[14px] font-semibold" style={{ color: 'var(--status-t10-fg)' }}>Trust Stock’s Total</span>
                <span className="flex items-center gap-4">
                  <span className="flex gap-4">
                    <TotalChip value={sum(allItems, 'pfUsd')} cur="usd" />
                    <TotalChip value={sum(allItems, 'pfTl')} cur="tl" />
                  </span>
                  <span className="flex gap-4">
                    <TotalChip value={sum(allItems, 'invUsd')} cur="usd" prefix="INV/USD" />
                    <TotalChip value={sum(allItems, 'invTl')} cur="tl" prefix="INV/TL" />
                  </span>
                </span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

// ── Accounting Trust Stock (right) ─────────────────────────────────────────────────────────
type AccCol = { key: AmountKey | 'date'; dateOf?: keyof TrustStockItem; label: string; w: number; cur?: 'usd' | 'tl' };
const ACC_COLS: AccCol[] = [
  { key: 'paid1Usd', label: 'Paid/USD', w: 110, cur: 'usd' }, { key: 'date', dateOf: 'paid1UsdDate', label: 'Date', w: 100 },
  { key: 'paid2Usd', label: 'Paid/USD', w: 110, cur: 'usd' }, { key: 'date', dateOf: 'paid2UsdDate', label: 'Date', w: 100 },
  { key: 'paid1Tl', label: 'Paid/TL', w: 110, cur: 'tl' }, { key: 'date', dateOf: 'paid1TlDate', label: 'Date', w: 100 },
  { key: 'paid2Tl', label: 'Paid/TL', w: 110, cur: 'tl' }, { key: 'date', dateOf: 'paid2TlDate', label: 'Date', w: 100 },
  { key: 'remainingUsd', label: 'USD', w: 104, cur: 'usd' }, { key: 'remainingTl', label: 'TL', w: 100, cur: 'tl' },
  { key: 'notOrderedUsd', label: 'USD', w: 104, cur: 'usd' }, { key: 'notOrderedTl', label: 'TL', w: 100, cur: 'tl' },
  { key: 'invUsd', label: 'Invoice', w: 104, cur: 'usd' }, { key: 'invTl', label: '', w: 100, cur: 'tl' },
];
const ACC_GROUPS = ['1st', '2nd', '1st', '2nd', 'Remaining', 'Not Ordered', 'Invoice'];

function AccountingTable({ stocks, allItems, onOpen }: { stocks: TrustStock[]; allItems: TrustStockItem[]; onOpen: OpenItem }) {
  const width = ACC_COLS.reduce((t, c) => t + c.w, 0) + 16;
  const paidUsd = sum(allItems, 'paid1Usd') + sum(allItems, 'paid2Usd');
  const paidTl = sum(allItems, 'paid1Tl') + sum(allItems, 'paid2Tl');
  return (
    <section aria-label="Accounting Trust Stock" className="overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg" style={{ width }}>
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col style={{ width: 8 }} />
          {ACC_COLS.map((c, i) => <col key={i} style={{ width: c.w }} />)}
          <col style={{ width: 8 }} />
        </colgroup>
        <thead>
          <tr className="h-[52px]" style={{ background: 'var(--status-t7-bg)' }}>
            <th colSpan={ACC_COLS.length + 2} scope="colgroup" className="text-center text-[20px] font-semibold" style={{ color: 'var(--status-t7-fg)' }}>Accounting Trust Stock</th>
          </tr>
          <tr className="h-[46px] border-b border-ui-divider" style={{ background: 'var(--status-t0-bg)' }}>
            <th aria-hidden />
            {ACC_COLS.map((c, i) => <th key={i} scope="col" className={TH}>{c.label}</th>)}
            <th aria-hidden />
          </tr>
        </thead>
        {stocks.map(s => (
          <tbody key={s.id}>
            <tr className={cn(H_BAR, GROUP_BAR, 'border-b border-ui-divider')}>
              <td />
              {ACC_GROUPS.map((g, i) => (
                <td key={i} colSpan={2} className="px-2">
                  <span className="flex h-6 w-full items-center justify-center rounded-[4px] bg-white text-[12px] font-medium text-[#3d3d43]">{g}</span>
                </td>
              ))}
              <td />
            </tr>
            {s.items.length === 0 ? (
              <tr className={cn(H_ROW, 'border-b border-ui-divider')}><td colSpan={ACC_COLS.length + 2} /></tr>
            ) : s.items.map(i => (
              <tr key={i.id} {...rowKeys(() => onOpen(s.id, i))} aria-label={`Edit accounting for ${i.pfCode}`} className={cn(H_ROW, 'cursor-pointer border-b border-ui-divider hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ui-focus-ring')}>
                <td />
                {ACC_COLS.map((c, ci) => (
                  <td key={ci} className={CELL}>
                    {c.key === 'date'
                      ? fmtDay((i[c.dateOf!] as string | null) ?? null)
                      : <Money value={amountOf(i, c.key)} cur={c.cur!} />}
                  </td>
                ))}
                <td />
              </tr>
            ))}
            <tr className={cn(H_TOTAL, GROUP_BAR)}>
              <td />
              {ACC_COLS.map((c, ci) => (
                <td key={ci} className="px-2">
                  {c.key !== 'date' && <TotalChip value={sum(s.items, c.key)} cur={c.cur!} />}
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        ))}
        <tfoot>
          <tr className="h-[52px]" style={{ background: 'var(--status-t7-bg)' }}>
            <td colSpan={ACC_COLS.length + 2} className="px-6">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[14px] font-semibold" style={{ color: 'var(--status-t7-fg)' }}>Accounting Grand Total</span>
                <span className="flex gap-4" title="Total paid">
                  <TotalChip value={paidUsd} cur="usd" />
                  <TotalChip value={paidTl} cur="tl" />
                </span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

function amountOf(i: TrustStockItem, key: AmountKey) {
  return sum([i], key);
}

