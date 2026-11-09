'use client';

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import {
  ArrowDownUp, BookmarkCheck, ChevronDown, CircleAlert, CircleDashed, Drill, Eye, Hourglass, LogIn, Package,
  PackageOpen, Plus, RefreshCw, Search, X, type LucideIcon,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { PartStatus, StockPart, TrustStock, TrustStockItem } from './types';
import {
  available, fmtDay, newId, onHand, partStatus, remainingPct, reorderPcs, toOrder, used, useStockParts,
} from './store';

// Figma "Stock Overview" (node 601:27426): quantities of every item received under the Trust
// Stock lines — KPI cards, status tabs, and one block per stock order (the line's stock, order#,
// vendor and date). Received, target and reorder % are edited in place. Frontend only: items
// live in this tab (store.ts) until a Trust Stock backend exists.

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const GROUP_BAR = 'bg-[#848484]';

const STATUS: Record<PartStatus, { label: string; bg: string; fg: string }> = {
  healthy: { label: 'Healthy', bg: 'var(--status-t9-bg)', fg: 'var(--status-t9-fg)' },
  watch: { label: 'Watch', bg: '#b75308', fg: '#fff' },
  reorder: { label: 'Reorder Now', bg: '#801c1e', fg: '#fff' },
  out: { label: 'Out of Stock', bg: '#b91c1d', fg: '#fff' },
  pending: { label: 'Pending Verification', bg: '#6b7380', fg: '#fff' },
};

type Tab = 'all' | PartStatus | 'reorder_list';
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'healthy', label: 'Healthy' },
  { key: 'watch', label: 'Watch' },
  { key: 'reorder', label: 'Reorder Now' },
  { key: 'out', label: 'Out of Stock' },
  { key: 'pending', label: 'Pending Verification' },
  { key: 'reorder_list', label: 'Re-Order' },
];

type ColKey = 'stock' | 'itemCode' | 'description' | 'dimensions' | 'ordered' | 'received' | 'target' | 'taken' | 'returned'
  | 'onHand' | 'reserved' | 'available' | 'remaining' | 'reorderAt' | 'order' | 'status' | 'usedIn';
const COLUMNS: { key: ColKey; label: ReactNode; text: string; w: number }[] = [
  { key: 'stock', label: 'Stock Order', text: 'Stock Order', w: 100 },
  { key: 'itemCode', label: 'Item Code', text: 'Item Code', w: 110 },
  { key: 'description', label: 'Description', text: 'Description', w: 240 },
  { key: 'dimensions', label: 'Dimensions', text: 'Dimensions', w: 110 },
  { key: 'ordered', label: 'Ordered', text: 'Ordered', w: 80 },
  { key: 'received', label: <>Confirmed<br />Received</>, text: 'Confirmed Received', w: 96 },
  { key: 'target', label: <>Target<br />Stock</>, text: 'Target Stock', w: 96 },
  { key: 'taken', label: 'Taken', text: 'Taken', w: 70 },
  { key: 'returned', label: 'Returned', text: 'Returned', w: 80 },
  { key: 'onHand', label: 'On Hand', text: 'On Hand', w: 80 },
  { key: 'reserved', label: 'Reserved', text: 'Reserved', w: 80 },
  { key: 'available', label: 'Available', text: 'Available', w: 90 },
  { key: 'remaining', label: 'Remaining %', text: 'Remaining %', w: 100 },
  { key: 'reorderAt', label: 'Reorder at %', text: 'Reorder at %', w: 110 },
  { key: 'order', label: 'Order', text: 'Order', w: 80 },
  { key: 'status', label: 'Status', text: 'Status', w: 150 },
  { key: 'usedIn', label: 'Used in', text: 'Used in', w: 110 },
];

interface Line { stock: TrustStock; line: TrustStockItem; parts: StockPart[] }

export function StockOverview({ open, onOpenChange, stocks }: { open: boolean; onOpenChange: (open: boolean) => void; stocks: TrustStock[] }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/70 transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <DialogPrimitive.Popup className="fixed inset-2 z-50 flex flex-col gap-6 overflow-hidden rounded-[11px] bg-ui-page-bg p-5 font-ui text-ui-body shadow-04 outline-none transition-[scale,opacity] duration-150 data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:opacity-0 sm:inset-6 sm:p-8">
          {open && <Body stocks={stocks} />}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Body({ stocks }: { stocks: TrustStock[] }) {
  const { parts, savePart, patchPart, removePart } = useStockParts();
  const [query, setQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [tab, setTab] = useState<Tab>('all');
  const [hidden, setHidden] = useState<Set<ColKey>>(new Set());
  const [editing, setEditing] = useState<{ lineId: string; part: StockPart | null } | null>(null);
  const cols = COLUMNS.filter(c => !hidden.has(c.key));

  const lines: Line[] = useMemo(() => stocks.flatMap(stock => stock.items.map(line => ({ stock, line, parts: parts[line.id] ?? [] }))), [stocks, parts]);
  const allParts = useMemo(() => lines.flatMap(l => l.parts), [lines]);

  const kpi = useMemo(() => {
    const t = (f: (p: StockPart) => number) => allParts.reduce((n, p) => n + f(p), 0);
    const count = (s: PartStatus) => allParts.filter(p => partStatus(p) === s).length;
    return {
      ordered: t(p => p.ordered), received: t(p => p.received ?? 0), onHand: t(onHand), used: t(used),
      reserved: t(p => p.reserved), available: t(available),
      reorder: count('reorder'), out: count('out'), watch: count('watch'), pending: count('pending'),
      reorderList: allParts.filter(p => toOrder(p) > 0).length,
    };
  }, [allParts]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const keep = (p: StockPart) =>
      (tab === 'all' || (tab === 'reorder_list' ? toOrder(p) > 0 : partStatus(p) === tab)) &&
      (!q || `${p.itemCode} ${p.description} ${p.usedIn.join(' ')}`.toLowerCase().includes(q));
    const lineMatches = (l: Line) => !!q && `stock-${l.stock.code} ${l.line.orderNo} ${l.line.vendor} ${l.line.pfCode}`.toLowerCase().includes(q);
    return lines
      .filter(l => !stockFilter || l.stock.id === stockFilter)
      .map(l => ({ ...l, parts: lineMatches(l) && tab === 'all' ? l.parts : l.parts.filter(keep) }))
      // With no filter on, an order with no items still shows (so items can be added to it).
      .filter(l => l.parts.length > 0 || (tab === 'all' && (!q || lineMatches(l))))
      .sort((a, b) => {
        const da = a.line.std ?? '', db = b.line.std ?? '';
        return sortBy === 'newest' ? db.localeCompare(da) : da.localeCompare(db);
      });
  }, [lines, query, stockFilter, tab, sortBy]);

  const editingLine = editing ? lines.find(l => l.line.id === editing.lineId) : null;

  return (
    <>
      <header className="flex items-start justify-between gap-4">
        <DialogPrimitive.Title className={cn('m-0 text-[28px] font-semibold leading-tight', HEADING)}>Stock Overview</DialogPrimitive.Title>
        <DialogPrimitive.Close aria-label="Close" className={cn('grid size-8 shrink-0 cursor-pointer place-items-center rounded-[6px] border-0 bg-transparent hover:bg-ui-hover-bg', HEADING)}>
          <X size={28} strokeWidth={1.5} />
        </DialogPrimitive.Close>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
        {/* ── KPIs ── */}
        <div className="flex flex-col gap-[7px]">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-6">
            <Kpi icon={Package} label="Total Orders" value={kpi.ordered} />
            <Kpi icon={LogIn} label="Total Received" value={kpi.received} />
            <Kpi icon={Hourglass} label="Remaining" note="(On hand)" value={kpi.onHand} />
            <Kpi icon={Drill} label="Used" note="(net of returns)" value={kpi.used} />
            <Kpi icon={BookmarkCheck} label="Reserved" value={kpi.reserved} />
            <Kpi icon={CircleDashed} label="Available" value={kpi.available} />
          </div>
          <div className="grid grid-cols-2 gap-1 xl:grid-cols-4">
            <Kpi tone="#b91c1d" icon={RefreshCw} label="Need Reorder" value={kpi.reorder} onClick={() => setTab('reorder')} />
            <Kpi tone="#801c1e" icon={CircleAlert} label="Out of Stock" value={kpi.out} onClick={() => setTab('out')} />
            <Kpi tone="#b75308" icon={Eye} label="On Watch" value={kpi.watch} onClick={() => setTab('watch')} />
            <Kpi tone="#6b7380" icon={Hourglass} label="Pending Verification" value={kpi.pending} onClick={() => setTab('pending')} />
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-[300px] max-w-full">
              <Search size={16} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
              <input
                type="search" aria-label="Search stock" placeholder="Search stock…" value={query} onChange={e => setQuery(e.target.value)}
                className="h-9 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-2.5 text-[13px] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
              />
            </div>
            <Select
              aria-label="Stock order"
              className="h-9 w-auto rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] font-medium text-ui-heading dark:rounded-[6px] dark:border-[var(--ui-input-border)] dark:bg-ui-input-bg [&_svg]:size-3.5"
              value={stockFilter} onValueChange={v => setStockFilter(v ?? '')}
              options={[{ value: '', label: 'All Stock Orders' }, ...stocks.map(s => ({ value: s.id, label: `STOCK-${s.code}` }))]}
            />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <ArrowDownUp aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-ui-heading" />
              <Select
                aria-label="Sort"
                className="h-9 w-auto rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-3 text-[13px] font-medium text-ui-heading dark:rounded-[6px] dark:border-[var(--ui-input-border)] dark:bg-ui-input-bg dark:pl-[34px] [&_svg]:size-3.5"
                value={sortBy} onValueChange={v => setSortBy((v ?? 'newest') as 'newest' | 'oldest')}
                options={[{ value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' }]}
              />
            </div>
            <ColumnsMenu hidden={hidden} onToggle={k => setHidden(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; })} />
          </div>
        </div>

        {/* ── Tabs ── */}
        <div role="tablist" aria-label="Stock status" className="flex flex-wrap items-center gap-1 border-b border-ui-divider pb-3">
          {TABS.map(t => (
            <button
              key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={cn(
                'h-9 cursor-pointer rounded-[6px] border-0 px-4 text-[13px]',
                tab === t.key ? cn('bg-[var(--ui-selected-bg)] font-semibold', HEADING) : 'bg-transparent text-ui-body hover:bg-ui-hover-bg',
              )}
            >
              {t.label}{t.key === 'reorder_list' ? ` (${kpi.reorderList})` : ''}
            </button>
          ))}
        </div>

        {/* ── Table ── */}
        {lines.length === 0 ? (
          <EmptyState boxed icon={<PackageOpen />} title="No stock orders yet" description="Add lines to a stock in Trust Stock, then track their items here." />
        ) : shown.length === 0 ? (
          <EmptyState boxed icon={<Search />} title="Nothing here" description="No items match this tab or search." />
        ) : (
          <div className="overflow-x-auto rounded-[8px] border border-ui-divider">
            <table className="w-full min-w-max table-fixed border-collapse">
              <colgroup>{cols.map(c => <col key={c.key} style={{ width: c.w }} />)}</colgroup>
              <thead>
                <tr className="h-[46px] border-b border-ui-divider bg-ui-surface">
                  {cols.map(c => <th key={c.key} scope="col" className="px-2.5 text-left text-[12px] font-semibold leading-tight text-ui-body">{c.label}</th>)}
                </tr>
              </thead>
              {shown.map(l => (
                <tbody key={l.line.id}>
                  <tr className={cn('h-[46px] text-white', GROUP_BAR)}>
                    <td colSpan={cols.length} className="px-3">
                      <div className="flex items-center gap-6 whitespace-nowrap">
                        <span className="text-[14px] font-semibold">STOCK-{l.stock.code}</span>
                        <span className="text-[14px] font-semibold">{l.line.orderNo || l.line.pfCode}</span>
                        {l.line.vendor && <span className="text-[14px] font-semibold">{l.line.vendor}</span>}
                        <span className="text-[12px]">{fmtDay(l.line.std)}</span>
                        <span className="ml-auto flex items-center gap-2">
                          <button
                            type="button" onClick={() => setEditing({ lineId: l.line.id, part: null })}
                            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[6px] border border-white bg-transparent px-3 text-[13px] font-medium text-white hover:bg-white/10"
                          >
                            <Plus size={14} aria-hidden /> Add item
                          </button>
                          {/* PDFs live in Dropbox; opening them here needs the backend. */}
                          <button type="button" disabled title="PDF isn't connected yet" className="h-8 cursor-not-allowed rounded-[6px] border border-white bg-white px-4 text-[13px] font-medium text-[#3d3d43] opacity-60">
                            View PDF
                          </button>
                        </span>
                      </div>
                    </td>
                  </tr>
                  {l.parts.length === 0 ? (
                    <tr className="h-[52px] border-b border-ui-divider"><td colSpan={cols.length} className="px-4 text-[12px] text-ui-text-secondary">No items yet.</td></tr>
                  ) : l.parts.map(p => (
                    <PartRow key={p.id} part={p} stockCode={l.stock.code} cols={cols.map(c => c.key)}
                      onPatch={patch => patchPart(l.line.id, p.id, patch)}
                      onEdit={() => setEditing({ lineId: l.line.id, part: p })} />
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </div>

      <PartDialog
        open={!!editing && !!editingLine}
        onOpenChange={o => { if (!o) setEditing(null); }}
        title={editingLine ? `STOCK-${editingLine.stock.code} · ${editingLine.line.orderNo || editingLine.line.pfCode}` : ''}
        part={editing?.part ?? null}
        onSave={p => editing && savePart(editing.lineId, p)}
        onRemove={id => editing && removePart(editing.lineId, id)}
      />
    </>
  );
}

function Kpi({ icon: Icon, label, note, value, tone, onClick }: {
  icon: LucideIcon; label: string; note?: string; value: number; tone?: string; onClick?: () => void;
}) {
  const content = (
    <span className="flex items-center gap-2">
      <span className={cn('grid size-[43px] shrink-0 place-items-center rounded-[8px]', tone ? 'bg-white/15' : 'bg-ui-surface-elevated')}>
        <Icon size={24} strokeWidth={1.5} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col pt-0.5 text-left">
        <span className="truncate text-[11px] leading-[1.03] tracking-[-0.242px]">{label}</span>
        {note && <span className="truncate text-[8px] leading-[1.03]">{note}</span>}
        <span className="mt-1 text-[20px] font-semibold leading-none tracking-[0.4px]">{value.toLocaleString('en-US')}</span>
      </span>
    </span>
  );
  const cls = cn('flex min-w-0 rounded-[11px] py-1 pl-1 pr-4', tone ? 'text-white' : cn('bg-[var(--ui-selected-bg)]', HEADING));
  return onClick
    ? <button type="button" onClick={onClick} className={cn(cls, 'cursor-pointer border-0 font-inherit hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring')} style={{ background: tone }}>{content}</button>
    : <div className={cls} style={tone ? { background: tone } : undefined}>{content}</div>;
}

function NumberBox({ value, onChange, label, nullable }: { value: number | null; onChange: (v: number | null) => void; label: string; nullable?: boolean }) {
  return (
    <input
      type="number" min="0" inputMode="numeric" aria-label={label}
      value={value ?? ''} placeholder={nullable ? '—' : '0'}
      onChange={e => onChange(e.target.value === '' ? (nullable ? null : 0) : Math.max(0, Number(e.target.value) || 0))}
      onClick={e => e.stopPropagation()}
      className="h-7 w-[48px] rounded-[4px] border border-ui-divider bg-ui-page-bg px-1.5 text-center text-[13px] text-ui-heading outline-none [appearance:textfield] focus-visible:outline-2 focus-visible:outline-ui-focus-ring [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
}

function PartRow({ part: p, stockCode, cols, onPatch, onEdit }: {
  part: StockPart; stockCode: string; cols: ColKey[]; onPatch: (patch: Partial<StockPart>) => void; onEdit: () => void;
}) {
  const st = STATUS[partStatus(p)];
  const order = toOrder(p);
  const cell = (k: ColKey): ReactNode => {
    switch (k) {
      case 'stock': return <span className={cn('text-[12px] font-semibold leading-tight', HEADING)}>STOCK<br />{stockCode}</span>;
      case 'itemCode': return (
        <button type="button" onClick={onEdit} className={cn('cursor-pointer border-0 bg-transparent p-0 text-left text-[13px] font-semibold underline-offset-2 hover:underline', HEADING)} aria-label={`Edit ${p.itemCode}`}>
          {p.itemCode}
        </button>
      );
      case 'description': return <span className="line-clamp-3 text-[11px] leading-[1.3]" title={p.description}>{p.description || '—'}</span>;
      case 'dimensions': return (
        <span className="flex flex-col gap-0.5">
          {([['D', p.depth], ['W', p.width], ['H', p.height]] as const).map(([k2, v]) => (
            <span key={k2} className="rounded-[2px] bg-[var(--ui-selected-bg)] px-1 text-[10px] leading-4 text-ui-body">{k2}= {v || '—'}</span>
          ))}
        </span>
      );
      case 'ordered': return p.ordered;
      case 'received': return <NumberBox label={`Confirmed received for ${p.itemCode}`} value={p.received} nullable onChange={v => onPatch({ received: v })} />;
      case 'target': return <NumberBox label={`Target stock for ${p.itemCode}`} value={p.target} onChange={v => onPatch({ target: v ?? 0 })} />;
      case 'taken': return p.taken;
      case 'returned': return p.returned;
      case 'onHand': return onHand(p);
      case 'reserved': return p.reserved;
      case 'available': return available(p);
      case 'remaining': return p.received == null ? '—' : `${remainingPct(p)}%`;
      case 'reorderAt': return (
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1">
            <NumberBox label={`Reorder at percent for ${p.itemCode}`} value={p.reorderAt} onChange={v => onPatch({ reorderAt: Math.min(100, v ?? 0) })} />
            <span className="text-[12px]">%</span>
          </span>
          <span className="text-[9px] text-ui-text-secondary">&lt; {reorderPcs(p)} PCS</span>
        </span>
      );
      case 'order': return order > 0
        ? <span className="inline-flex h-7 items-center rounded-[4px] px-2.5 text-[13px] font-medium" style={{ background: 'var(--status-t7-bg)', color: 'var(--status-t8-fg)' }}>{order}</span>
        : <span className="text-ui-text-secondary">—</span>;
      case 'status': return <span className="inline-flex h-7 items-center rounded-[4px] px-3 text-[11px] font-medium" style={{ background: st.bg, color: st.fg }}>{st.label}</span>;
      case 'usedIn': return p.usedIn.length
        ? <span className="text-[12px]" style={{ color: 'var(--status-t6-fg)' }} title={p.usedIn.join(', ')}>{p.usedIn.length} Project(s)</span>
        : <span className="text-ui-text-secondary">—</span>;
    }
  };
  return (
    <tr className="h-[63px] border-b border-ui-divider">
      {cols.map(k => <td key={k} className="px-2.5 text-[13px] text-ui-heading">{cell(k)}</td>)}
    </tr>
  );
}

function ColumnsMenu({ hidden, onToggle }: { hidden: Set<ColKey>; onToggle: (k: ColKey) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(o => !o)}
        className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] font-medium text-ui-heading"
      >
        <Eye size={14} aria-hidden /> Columns <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 flex max-h-[360px] w-56 flex-col overflow-y-auto rounded-[6px] border border-ui-divider bg-ui-surface-elevated p-1.5 shadow-03">
          {COLUMNS.map(c => (
            <label key={c.key} className="flex h-8 cursor-pointer items-center gap-2 rounded-[4px] px-2 text-[13px] text-ui-body hover:bg-ui-hover-bg">
              <input type="checkbox" checked={!hidden.has(c.key)} onChange={() => onToggle(c.key)} disabled={c.key === 'itemCode'} />
              {c.text}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add / edit an item ─────────────────────────────────────────────────────────────────────
const blankPart = (): StockPart => ({
  id: newId(), itemCode: '', description: '', depth: '', width: '', height: '', ordered: 0, received: null,
  target: 0, taken: 0, returned: 0, reserved: 0, reorderAt: 30, usedIn: [],
});

function PartDialog({ open, onOpenChange, title, part, onSave, onRemove }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; part: StockPart | null;
  onSave: (p: StockPart) => void; onRemove: (id: string) => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="lg" title={part ? 'Edit item' : 'Add item'} description={title}>
        {open && <PartForm key={part?.id ?? 'new'} part={part} onDone={() => onOpenChange(false)} onSave={onSave} onRemove={onRemove} />}
      </ModalContent>
    </Modal>
  );
}

function PartForm({ part, onDone, onSave, onRemove }: { part: StockPart | null; onDone: () => void; onSave: (p: StockPart) => void; onRemove: (id: string) => void }) {
  const [v, setV] = useState<StockPart>(() => part ?? blankPart());
  const [usedIn, setUsedIn] = useState(() => (part?.usedIn ?? []).join(', '));
  const uid = useId();
  const put = <K extends keyof StockPart>(k: K, val: StockPart[K]) => setV(prev => ({ ...prev, [k]: val }));
  const num = (k: 'ordered' | 'target' | 'taken' | 'returned' | 'reserved', label: string) => (
    <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
      {label}
      <Input type="number" min="0" inputMode="numeric" value={v[k] || ''} placeholder="0" onChange={e => put(k, Math.max(0, Number(e.target.value) || 0))} />
    </label>
  );
  const canSave = !!v.itemCode.trim();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onSave({ ...v, itemCode: v.itemCode.trim(), description: v.description.trim(), usedIn: usedIn.split(',').map(s => s.trim()).filter(Boolean) });
    onDone();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
          Item code
          <Input value={v.itemCode} onChange={e => put('itemCode', e.target.value)} required autoFocus placeholder="e.g. FA20" />
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
          Confirmed received
          <Input type="number" min="0" value={v.received ?? ''} placeholder="Not verified yet"
            onChange={e => put('received', e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0))} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
        Description
        <Input value={v.description} onChange={e => put('description', e.target.value)} />
      </label>
      <div className="grid grid-cols-3 gap-3">
        {(['depth', 'width', 'height'] as const).map(k => (
          <label key={k} className="flex flex-col gap-1.5 text-[12px] font-medium capitalize text-ui-heading">
            {k}
            <Input value={v[k]} onChange={e => put(k, e.target.value)} placeholder={'25.5"'} />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {num('ordered', 'Ordered')}
        {num('target', 'Target stock')}
        {num('taken', 'Taken')}
        {num('returned', 'Returned')}
        {num('reserved', 'Reserved')}
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
          Reorder at %
          <Input type="number" min="0" max="100" value={v.reorderAt} onChange={e => put('reorderAt', Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
        </label>
      </div>
      <label htmlFor={`${uid}-used`} className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-heading">
        Used in projects
        <Input id={`${uid}-used`} value={usedIn} onChange={e => setUsedIn(e.target.value)} placeholder="Comma separated, e.g. STW 460, STE 512" />
      </label>
      <div className="-mx-5 flex flex-wrap items-center justify-end gap-2 border-t border-ui-divider px-5 pt-4">
        <p className="m-0 mr-auto text-[11px] text-ui-text-secondary">Kept on this device until Trust Stock saving is connected.</p>
        {part && <Button type="button" variant="ghost" className="text-error-normal" onClick={() => { onRemove(part.id); onDone(); }}>Remove item</Button>}
        <Button type="button" variant="secondary" className={modalSecondaryButtonClass} onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={!canSave}>{part ? 'Save' : 'Add item'}</Button>
      </div>
    </form>
  );
}
