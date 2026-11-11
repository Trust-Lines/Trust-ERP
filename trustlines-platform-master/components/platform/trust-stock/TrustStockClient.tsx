'use client';

import { useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Boxes, Plus, Rows3, Search, Upload } from 'lucide-react';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { TrustStock, TrustStockItem } from './types';
import { addImportedPf, dimsFromText, fmtDay, newId, stockTile, sum, tl, usd, useTrustStocks, type AmountKey } from './store';
import { NewStockDialog, PF_SIGN, SEND_STATUS, StockItemDialog } from './TrustStockForms';
import { StockOverview } from './StockOverview';
import { PfPdfImportDialog, type ImportedResult } from './PfPdfImportDialog';

// Figma "Trust Stock" (node 598:22796): the stock lines (PF, vendor, dates, PF/INV amounts) and the
// accounting for the same lines (payments, remaining, not ordered, invoice). The Projects /
// Accounting buttons pick which show; both on → side by side, rows lined up. Each stock batch is a coloured block with a total row;
// grand totals sit at the bottom, every total under its own column. Frontend only: no Trust Stock backend yet.
// Internal only — PF and vendor prices must never reach tlines_pm (the page enforces it).

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
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
    <span className="flex w-full items-center justify-end whitespace-nowrap rounded-[4px] bg-ui-page-bg py-1 pl-2.5 pr-2 text-[12px] font-medium leading-4 tabular-nums" style={{ color: cur === 'usd' ? USD_FG : TL_FG }}>
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

/** A PF imported into the Trust System → this page's row + its products (not yet received). */
function onImported({ stockCode, data, vendor, result, localOnly }: ImportedResult) {
  const id = result.id ?? newId();
  const total = data.totalPrice ?? 0;
  const rule = Number(data.paymentRule);
  addImportedPf(stockCode, {
    id,
    type: data.type ? data.type.charAt(0) + data.type.slice(1).toLowerCase() : 'Other',
    pfCode: result.pfCode ?? data.pfCode,
    vendor: vendor ? `${vendor.code} - ${vendor.name}` : '',
    orderNo: data.orderNo ?? '',
    pfSign: result.pfSignStatus === 'SIGNED' ? 'signed' : 'not_signed',
    status: 'not_sent',
    std: data.pfDate, rtr: null, rto: null,
    pfUsd: data.currency === 'USD' ? total : 0,
    pfTl: data.currency === 'TL' ? total : 0,
    invUsd: 0, invTl: 0,
    paymentRule: Number.isFinite(rule) && data.paymentRule ? rule : null,
    paid1Usd: 0, paid1UsdDate: null, paid2Usd: 0, paid2UsdDate: null,
    paid1Tl: 0, paid1TlDate: null, paid2Tl: 0, paid2TlDate: null,
    notOrderedUsd: 0, notOrderedTl: 0,
  }, data.products.map(p => ({
    id: newId(), itemCode: p.itemCode, description: p.description ?? '', ...dimsFromText(p.description ?? ''),
    ordered: p.quantity, received: null, target: p.quantity, taken: 0, returned: 0, reserved: 0, reorderAt: 30, usedIn: [],
  })));
  toast.success(`Added to ${stockCode}`, {
    description: `${data.pfCode} · ${data.products.length} product${data.products.length === 1 ? '' : 's'} — ${localOnly ? 'added to this page only (already in the Trust System)' : 'pending verification until received'}.`,
  });
}

export function TrustStockClient({ canUploadPf = false }: { canUploadPf?: boolean }) {
  const { stocks, addStock, saveItem, removeItem } = useTrustStocks();
  const [pdfOpen, setPdfOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [newStock, setNewStock] = useState(false);
  const [overview, setOverview] = useState(false);
  // Which tables show: Projects by default; both on → side by side with their rows lined up.
  const [shown, setShown] = useState({ projects: true, accounting: false });
  const toggle = (k: 'projects' | 'accounting') => setShown(v => {
    const next = { ...v, [k]: !v[k] };
    return next.projects || next.accounting ? next : v; // one always stays on
  });
  const [editing, setEditing] = useState<{ stockId: string; item: TrustStockItem | null } | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stocks;
    return stocks
      .map(s => `stock ${stockTile(s.code).rest}`.toLowerCase().includes(q) ? s : {
        ...s,
        items: s.items.filter(i => `${i.type} ${i.pfCode} ${i.vendor} ${i.orderNo}`.toLowerCase().includes(q)),
      })
      .filter(s => s.items.length > 0 || `stock ${stockTile(s.code).rest}`.toLowerCase().includes(q));
  }, [stocks, query]);

  const allItems = useMemo(() => visible.flatMap(s => s.items), [visible]);
  const editingStock = editing ? stocks.find(s => s.id === editing.stockId) : null;
  const openItem = (stockId: string, item: TrustStockItem | null) => setEditing({ stockId, item });

  return (
    <div className="flex flex-col gap-[30px]">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'Operations', href: '/production' }, { label: 'Trust Stock', href: '/trust-stock' }]} />
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Trust Stock</h1>
        <p className="m-0 text-[13px] text-ui-body">
          {stocks.length} stock{stocks.length === 1 ? '' : 's'} · {stocks.reduce((n, s) => n + s.items.length, 0)} line{stocks.reduce((n, s) => n + s.items.length, 0) === 1 ? '' : 's'}
        </p>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Table" className="inline-flex h-9 rounded-[6px] border border-ui-divider bg-ui-surface p-0.5">
          {(['projects', 'accounting'] as const).map(v => (
            <button
              key={v} type="button" aria-pressed={shown[v]} onClick={() => toggle(v)}
              className={cn('cursor-pointer rounded-[4px] border-0 px-4 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ui-focus-ring',
                shown[v] ? 'bg-[var(--color-secondary-700)] text-white dark:bg-primary-50 dark:text-primary-950' : 'bg-transparent text-ui-body hover:bg-ui-hover-bg')}
            >
              {v === 'projects' ? 'Projects' : 'Accounting'}
            </button>
          ))}
        </div>
        <div className="relative w-[285px] max-w-full">
          <Search size={16} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
          <input
            type="search" aria-label="Search stock" placeholder="Search project…"
            value={query} onChange={e => setQuery(e.target.value)}
            className="h-9 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-2.5 text-[13px] leading-[1.45] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
          />
        </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Figma toolbar (node 598:22871): Upload PF PDF (outline), Stock Contents (primary), New Stock (accent).
              Upload reads the PF in the Trust System (PfPdfImportDialog); hidden for roles that can't write there. */}
          {canUploadPf && (
            <button
              type="button" onClick={() => setPdfOpen(true)}
              className={cn('inline-flex h-9 cursor-pointer items-center gap-2 rounded-[6px] border border-[var(--color-secondary-700)] bg-transparent pl-4 pr-5 text-[13px] font-medium leading-[1.35] transition-colors hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring dark:border-ui-heading', HEADING)}
            >
              <Upload size={16} aria-hidden /> Upload PF PDF
            </button>
          )}
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
            {shown.projects && <StockTable stocks={visible} allItems={allItems} onOpen={openItem} />}
            {shown.accounting && <AccountingTable stocks={visible} allItems={allItems} onOpen={openItem} />}
          </div>
        </div>
      )}

      <StockOverview open={overview} onOpenChange={setOverview} stocks={stocks} />
      {canUploadPf && <PfPdfImportDialog open={pdfOpen} onOpenChange={setPdfOpen} onImported={onImported} />}
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

// Excel-like grid: a rule between every column, amounts right-aligned, every total in its own column.
const V = 'border-r border-ui-divider last:border-r-0';
const MONEY = 'text-right tabular-nums';

function StockTile({ code, rowSpan, gi }: { code: string; rowSpan: number; gi: number }) {
  const t = stockTile(code);
  return (
    <th
      rowSpan={rowSpan} scope="rowgroup"
      className="border-r border-ui-divider px-2 text-center align-middle text-[20px] font-medium leading-tight text-white"
      style={{ background: TILE[gi % TILE.length] }}
    >
      {t.head}<br />{t.rest}
    </th>
  );
}

// ── Projects: the stock lines ──────────────────────────────────────────────────────────────
type LeftCol = { label: string; w: number; money?: AmountKey };
const LEFT_COLS: LeftCol[] = [
  { label: 'Project#', w: 118 }, { label: 'Type', w: 124 }, { label: 'PF Code', w: 150 }, { label: 'Vendor', w: 220 },
  { label: 'Order#', w: 120 }, { label: 'PF Sign Status', w: 120 }, { label: 'Status', w: 120 }, { label: 'STD', w: 100 },
  { label: 'RTR', w: 100 }, { label: 'RTO', w: 100 }, { label: 'PF/USD', w: 120, money: 'pfUsd' }, { label: 'PF/TL', w: 120, money: 'pfTl' },
  { label: 'INV/USD', w: 120, money: 'invUsd' }, { label: 'INV/TL', w: 120, money: 'invTl' }, { label: 'Payment Rule', w: 110 },
];
const FIRST_MONEY = LEFT_COLS.findIndex(c => c.money);
const curOf = (k: AmountKey): 'usd' | 'tl' => (/Tl$/.test(k) ? 'tl' : 'usd');

function StockTable({ stocks, allItems, onOpen }: { stocks: TrustStock[]; allItems: TrustStockItem[]; onOpen: OpenItem }) {
  const width = LEFT_COLS.reduce((t, c) => t + c.w, 0);
  const moneyCols = LEFT_COLS.filter(c => c.money);
  return (
    <section aria-label="Trust Stock" className="overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg" style={{ width }}>
      <table className="w-full table-fixed border-collapse">
        <colgroup>{LEFT_COLS.map(c => <col key={c.label} style={{ width: c.w }} />)}</colgroup>
        <thead>
          <tr className="h-[52px]" style={{ background: 'var(--status-t10-bg)' }}>
            <th colSpan={LEFT_COLS.length} scope="colgroup" className="text-center text-[20px] font-semibold" style={{ color: 'var(--status-t10-fg)' }}>Trust Stock</th>
          </tr>
          <tr className="h-[68px] border-b border-ui-divider" style={{ background: 'var(--status-t0-bg)' }}>
            {LEFT_COLS.map(c => <th key={c.label} scope="col" className={cn(TH, V, c.money && 'text-right')}>{c.label}</th>)}
          </tr>
        </thead>
        {stocks.map((s, gi) => (
          <tbody key={s.id}>
            {s.items.length === 0 ? (
              <tr className={cn(H_ROW, 'border-b border-ui-divider')}>
                <StockTile code={s.code} rowSpan={2} gi={gi} />
                <td colSpan={LEFT_COLS.length - 1} className="px-4 text-[12px] text-ui-text-secondary">No lines yet.</td>
              </tr>
            ) : s.items.map((i, ri) => (
              <tr key={i.id} {...rowKeys(() => onOpen(s.id, i))} aria-label={`Edit ${i.pfCode}`} className={cn(H_ROW, 'cursor-pointer border-b border-ui-divider hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ui-focus-ring')}>
                {ri === 0 && <StockTile code={s.code} rowSpan={s.items.length + 1} gi={gi} />}
                <td className={cn('px-2', V)}><Chip className="text-[14px] font-semibold text-white" style={{ background: TYPE_BG[i.type] ?? '#787881' }}>{i.type}</Chip></td>
                <td className={cn(CELL, V, 'truncate text-[13px]')} title={i.pfCode}>{i.pfCode}</td>
                <td className={cn(CELL, V, 'truncate text-[13px]')} title={i.vendor}>{i.vendor || '—'}</td>
                <td className={cn(CELL, V, 'truncate text-[13px]')} title={i.orderNo}>{i.orderNo || '—'}</td>
                <td className={cn('px-2', V)}><Chip className="w-[81px]" style={SIGN_STYLE[i.pfSign]}>{label(PF_SIGN, i.pfSign)}</Chip></td>
                <td className={cn('px-2', V)}><Chip className="min-w-[80px]" style={STATUS_STYLE[i.status]}>{label(SEND_STATUS, i.status)}</Chip></td>
                <td className={cn(CELL, V)}>{fmtDay(i.std)}</td>
                <td className={cn(CELL, V)}>{fmtDay(i.rtr)}</td>
                <td className={cn(CELL, V)}>{fmtDay(i.rto)}</td>
                {moneyCols.map(c => <td key={c.label} className={cn(CELL, V, MONEY)}><Money value={amountOf(i, c.money!)} cur={curOf(c.money!)} /></td>)}
                <td className={cn(CELL, V, MONEY)}>{i.paymentRule != null ? `${i.paymentRule} %` : '—'}</td>
              </tr>
            ))}
            <tr className={cn(H_TOTAL, GROUP_BAR)}>
              <td colSpan={FIRST_MONEY - 1} className="border-r border-white/30 px-4 text-[14px] font-semibold text-[#eef2f6]">TOTAL</td>
              {moneyCols.map(c => <td key={c.label} className="border-r border-white/30 px-2"><TotalChip value={sum(s.items, c.money!)} cur={curOf(c.money!)} /></td>)}
              <td />
            </tr>
          </tbody>
        ))}
        <tfoot>
          <tr className="h-[52px]" style={{ background: 'var(--status-t10-bg)' }}>
            <td colSpan={FIRST_MONEY} className="border-r border-ui-divider px-6 text-[14px] font-semibold" style={{ color: 'var(--status-t10-fg)' }}>Trust Stock’s Total</td>
            {moneyCols.map(c => <td key={c.label} className={cn('px-2', V)}><TotalChip value={sum(allItems, c.money!)} cur={curOf(c.money!)} /></td>)}
            <td />
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

// ── Accounts: payments, remaining, not ordered, invoice for the same lines ─────────────────
type AccCol = { key: AmountKey | 'date'; dateOf?: keyof TrustStockItem; label: string; w: number; cur?: 'usd' | 'tl' };
const ACC_COLS: AccCol[] = [
  { key: 'paid1Usd', label: 'Paid/USD', w: 110, cur: 'usd' }, { key: 'date', dateOf: 'paid1UsdDate', label: 'Date', w: 100 },
  { key: 'paid2Usd', label: 'Paid/USD', w: 110, cur: 'usd' }, { key: 'date', dateOf: 'paid2UsdDate', label: 'Date', w: 100 },
  { key: 'paid1Tl', label: 'Paid/TL', w: 110, cur: 'tl' }, { key: 'date', dateOf: 'paid1TlDate', label: 'Date', w: 100 },
  { key: 'paid2Tl', label: 'Paid/TL', w: 110, cur: 'tl' }, { key: 'date', dateOf: 'paid2TlDate', label: 'Date', w: 100 },
  { key: 'remainingUsd', label: 'USD', w: 110, cur: 'usd' }, { key: 'remainingTl', label: 'TL', w: 110, cur: 'tl' },
  { key: 'notOrderedUsd', label: 'USD', w: 110, cur: 'usd' }, { key: 'notOrderedTl', label: 'TL', w: 110, cur: 'tl' },
  { key: 'invUsd', label: 'USD', w: 110, cur: 'usd' }, { key: 'invTl', label: 'TL', w: 110, cur: 'tl' },
];
const ACC_GROUPS = ['1st USD', '2nd USD', '1st TL', '2nd TL', 'Remaining', 'Not Ordered', 'Invoice'];
const ACC_LEAD = [{ label: 'Project#', w: 118 }, { label: 'PF Code', w: 150 }];

function AccountingTable({ stocks, allItems, onOpen }: { stocks: TrustStock[]; allItems: TrustStockItem[]; onOpen: OpenItem }) {
  const width = [...ACC_LEAD, ...ACC_COLS].reduce((t, c) => t + c.w, 0);
  const total = (items: TrustStockItem[], c: AccCol) => (c.key === 'date' ? null : <TotalChip value={sum(items, c.key)} cur={c.cur!} />);
  return (
    <section aria-label="Accounting Trust Stock" className="overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg" style={{ width }}>
      <table className="w-full table-fixed border-collapse">
        <colgroup>{[...ACC_LEAD, ...ACC_COLS].map((c, i) => <col key={i} style={{ width: c.w }} />)}</colgroup>
        <thead>
          <tr className="h-[52px]" style={{ background: 'var(--status-t7-bg)' }}>
            <th colSpan={ACC_LEAD.length + ACC_COLS.length} scope="colgroup" className="text-center text-[20px] font-semibold" style={{ color: 'var(--status-t7-fg)' }}>Accounting Trust Stock</th>
          </tr>
          <tr className="h-[34px] border-b border-ui-divider" style={{ background: 'var(--status-t0-bg)' }}>
            {ACC_LEAD.map(c => <th key={c.label} rowSpan={2} scope="col" className={cn(TH, V)}>{c.label}</th>)}
            {ACC_GROUPS.map(g => <th key={g} colSpan={2} scope="colgroup" className={cn(TH, V, 'text-center')}>{g}</th>)}
          </tr>
          <tr className="h-[34px] border-b border-ui-divider" style={{ background: 'var(--status-t0-bg)' }}>
            {ACC_COLS.map((c, i) => <th key={i} scope="col" className={cn(TH, V, c.key !== 'date' && 'text-right')}>{c.label}</th>)}
          </tr>
        </thead>
        {stocks.map((s, gi) => (
          <tbody key={s.id}>
            {s.items.length === 0 ? (
              <tr className={cn(H_ROW, 'border-b border-ui-divider')}>
                <StockTile code={s.code} rowSpan={2} gi={gi} />
                <td colSpan={ACC_COLS.length + 1} className="px-4 text-[12px] text-ui-text-secondary">No lines yet.</td>
              </tr>
            ) : s.items.map((i, ri) => (
              <tr key={i.id} {...rowKeys(() => onOpen(s.id, i))} aria-label={`Edit accounting for ${i.pfCode}`} className={cn(H_ROW, 'cursor-pointer border-b border-ui-divider hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ui-focus-ring')}>
                {ri === 0 && <StockTile code={s.code} rowSpan={s.items.length + 1} gi={gi} />}
                <td className={cn(CELL, V, 'truncate text-[13px]')} title={i.pfCode}>{i.pfCode}</td>
                {ACC_COLS.map((c, ci) => (
                  <td key={ci} className={cn(CELL, V, c.key !== 'date' && MONEY)}>
                    {c.key === 'date' ? fmtDay((i[c.dateOf!] as string | null) ?? null) : <Money value={amountOf(i, c.key)} cur={c.cur!} />}
                  </td>
                ))}
              </tr>
            ))}
            <tr className={cn(H_TOTAL, GROUP_BAR)}>
              <td className="border-r border-white/30 px-4 text-[14px] font-semibold text-[#eef2f6]">TOTAL</td>
              {ACC_COLS.map((c, ci) => <td key={ci} className="border-r border-white/30 px-2 last:border-r-0">{total(s.items, c)}</td>)}
            </tr>
          </tbody>
        ))}
        <tfoot>
          <tr className="h-[52px]" style={{ background: 'var(--status-t7-bg)' }}>
            <td colSpan={ACC_LEAD.length} className="border-r border-ui-divider px-4 text-[14px] font-semibold" style={{ color: 'var(--status-t7-fg)' }}>Accounting Grand Total</td>
            {ACC_COLS.map((c, ci) => <td key={ci} className={cn('px-2', V)}>{total(allItems, c)}</td>)}
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

function amountOf(i: TrustStockItem, key: AmountKey) {
  return sum([i], key);
}
