'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Boxes, Plus, Rows3, Search, Upload } from 'lucide-react';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { TrustStockItem } from './types';
import { addImportedPf, dimsFromText, newId, stockTile, useTrustStocks } from './store';
import { NewStockDialog } from './TrustStockForms';
import { StockOverview } from './StockOverview';
import { StockGrid } from './StockGrid';
import { PfPdfImportDialog, type ImportedResult } from './PfPdfImportDialog';

// Figma "Trust Stock" (node 598:22796): the stock lines (PF, vendor, dates, PF/INV amounts) and the
// accounting for the same lines (payments, remaining, not ordered, invoice) as Excel-like sheets
// (StockGrid). The Projects / Accounting buttons pick which show; both on → side by side, rows
// lined up. Cells edit in place. Frontend only: no Trust Stock backend yet.
// Internal only — PF and vendor prices must never reach tlines_pm (the page enforces it).

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';

/** A PF from "Upload PF PDF" → this page's row + its products (not yet received). */
function onImported({ stockCode, data, vendor, result, localOnly }: ImportedResult) {
  const total = data.totalPrice ?? 0;
  const rule = Number(data.paymentRule);
  addImportedPf(stockCode, {
    id: result.id ?? newId(),
    type: data.type ? data.type.charAt(0) + data.type.slice(1).toLowerCase() : 'Millwork',
    pfCode: result.pfCode ?? data.pfCode,
    vendor: vendor ? `${vendor.code} - ${vendor.name}` : '',
    orderNo: data.orderNo ?? '',
    pfSign: result.pfSignStatus ? result.pfSignStatus.replace(/_/g, ' ') : 'NOT SIGNED',
    status: 'NOT_ORDERED',
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
  // Which sheets show: Projects by default; both on → side by side.
  const [shown, setShown] = useState({ projects: true, accounting: false });
  const toggle = (k: 'projects' | 'accounting') => setShown(v => {
    const next = { ...v, [k]: !v[k] };
    return next.projects || next.accounting ? next : v; // one always stays on
  });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stocks;
    const hay = (code: string) => `stock ${stockTile(code).rest} ${code}`.toLowerCase();
    return stocks
      .map(s => hay(s.code).includes(q) ? s : {
        ...s,
        items: s.items.filter(i => `${i.type} ${i.pfCode} ${i.vendor} ${i.orderNo}`.toLowerCase().includes(q)),
      })
      .filter(s => s.items.length > 0 || hay(s.code).includes(q));
  }, [stocks, query]);

  const allItems = useMemo(() => visible.flatMap(s => s.items), [visible]);
  const lines = stocks.reduce((n, s) => n + s.items.length, 0);
  const patch = (stockId: string, item: TrustStockItem, p: Partial<TrustStockItem>) => saveItem(stockId, { ...item, ...p });

  return (
    <div className="flex flex-col gap-[30px]">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'Operations' }, { label: 'Trust Stock', href: '/trust-stock' }]} />
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Trust Stock</h1>
        <p className="m-0 text-[13px] text-ui-body">
          {stocks.length} stock{stocks.length === 1 ? '' : 's'} · {lines} line{lines === 1 ? '' : 's'}
        </p>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Sheets" className="inline-flex h-9 gap-0.5 rounded-[6px] border border-ui-divider bg-ui-surface p-0.5">
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
              type="search" aria-label="Search stock" placeholder="Search stock, PF, vendor…"
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
          description="Upload a PF PDF, or create a stock batch first."
          action={<button type="button" onClick={() => setNewStock(true)} className="inline-flex h-9 items-center gap-2 rounded-[6px] border-0 bg-ui-btn-accent px-5 text-[13px] font-medium text-ui-btn-accent-fg hover:opacity-90"><Plus size={16} aria-hidden /> New Stock</button>}
        />
      ) : visible.length === 0 ? (
        <EmptyState boxed icon={<Search />} title="No matching stock" description="Try another PF code, vendor, order or stock code." />
      ) : (
        <div className="overflow-x-auto pb-2">
          <StockGrid stocks={visible} allItems={allItems} shown={shown} onPatch={patch} onRemove={(stockId, item) => removeItem(stockId, item.id)} />
        </div>
      )}

      <StockOverview open={overview} onOpenChange={setOverview} stocks={stocks} />
      {canUploadPf && <PfPdfImportDialog open={pdfOpen} onOpenChange={setPdfOpen} onImported={onImported} />}
      <NewStockDialog open={newStock} onOpenChange={setNewStock} existing={stocks.map(s => s.code)} onCreate={addStock} />
    </div>
  );
}
