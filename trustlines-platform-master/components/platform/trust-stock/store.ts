'use client';

import { useSyncExternalStore } from 'react';
import type { PartStatus, StockPart, TrustStock, TrustStockItem } from './types';

// No Trust Stock backend yet: stocks and lines added on the page live in this tab's memory —
// they survive moving between pages, not a reload. Nothing here is sample data.

let stocks: TrustStock[] = [];
/** Stock Overview items, by Trust Stock line id. */
let parts: Record<string, StockPart[]> = {};
const NO_PARTS: Record<string, StockPart[]> = {};
const EMPTY: TrustStock[] = [];
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const set = (next: TrustStock[]) => { stocks = next; listeners.forEach(fn => fn()); };
const setParts = (next: Record<string, StockPart[]>) => { parts = next; listeners.forEach(fn => fn()); };
export const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export function useTrustStocks() {
  const list = useSyncExternalStore(subscribe, () => stocks, () => EMPTY);
  return {
    stocks: list,
    addStock: (code: string) => set([...stocks, { id: newId(), code, items: [] }]),
    saveItem: (stockId: string, item: TrustStockItem) => set(stocks.map(s => s.id !== stockId ? s : {
      ...s,
      items: s.items.some(i => i.id === item.id) ? s.items.map(i => (i.id === item.id ? item : i)) : [...s.items, item],
    })),
    removeItem: (stockId: string, itemId: string) => set(stocks.map(s => s.id !== stockId ? s : { ...s, items: s.items.filter(i => i.id !== itemId) })),
  };
}

/**
 * A PF saved through "Upload PF PDF" (the Trust System has it now): show it in this page's table
 * under its stock code — creating the stock if it isn't here — and its products in Stock Contents
 * as not yet received ("Pending verification").
 */
export function addImportedPf(stockCode: string, item: TrustStockItem, lineParts: StockPart[]) {
  const code = stockCode.trim();
  const existing = stocks.find(s => s.code.toLowerCase() === code.toLowerCase());
  set(existing
    ? stocks.map(s => (s.id === existing.id ? { ...s, items: [...s.items.filter(i => i.id !== item.id), item] } : s))
    : [...stocks, { id: newId(), code, items: [item] }]);
  setParts({ ...parts, [item.id]: lineParts });
}

/**
 * A stock's code split for the tile: "STOCK-TR-04" and "TR-04" both show as STOCK / TR-04, so the
 * word isn't doubled when the Trust System's code already carries it.
 */
export function stockTile(code: string): { head: string; rest: string } {
  const rest = code.trim().replace(/^stock[\s_-]*/i, '');
  return { head: 'STOCK', rest: rest || code.trim() };
}

/**
 * Depth / width / height written in a product description, e.g.
 * "CABINET … ( D=32.5"-W=40"-H=32.75")" or "(D=12"- W=48"- H=36,75")". Missing ones stay ''.
 */
export function dimsFromText(text: string): { depth: string; width: string; height: string } {
  const one = (k: string) => {
    const m = text.match(new RegExp(`(?:^|[^A-Za-z])${k}\\s*[=:]\\s*(\\d+(?:[.,]\\d+)?)\\s*("|''|”|in\\b|cm\\b|mm\\b)?`, 'i'));
    if (!m) return '';
    const unit = m[2] === "''" || m[2] === '”' ? '"' : (m[2] ?? '');
    return `${m[1].replace(',', '.')}${unit}`;
  };
  return { depth: one('D'), width: one('W'), height: one('H') };
}

// ── Money / totals ─────────────────────────────────────────────────────────────────────────
const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const usd = (n: number) => `$ ${fmt.format(n || 0)}`;
export const tl = (n: number) => `₺ ${fmt.format(n || 0)}`;

export function fmtDay(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return y && m && d ? `${m}/${d}/${y}` : iso;
}

export const remainingUsd = (i: TrustStockItem) => i.pfUsd - i.paid1Usd - i.paid2Usd;
export const remainingTl = (i: TrustStockItem) => i.pfTl - i.paid1Tl - i.paid2Tl;

export type AmountKey =
  | 'pfUsd' | 'pfTl' | 'invUsd' | 'invTl'
  | 'paid1Usd' | 'paid2Usd' | 'paid1Tl' | 'paid2Tl'
  | 'remainingUsd' | 'remainingTl' | 'notOrderedUsd' | 'notOrderedTl';

export function amount(i: TrustStockItem, key: AmountKey) {
  if (key === 'remainingUsd') return remainingUsd(i);
  if (key === 'remainingTl') return remainingTl(i);
  return i[key];
}

export const sum = (items: TrustStockItem[], key: AmountKey) => items.reduce((t, i) => t + (amount(i, key) || 0), 0);

export function useStockParts() {
  const byLine = useSyncExternalStore(subscribe, () => parts, () => NO_PARTS);
  return {
    parts: byLine,
    savePart: (lineId: string, part: StockPart) => {
      const list = parts[lineId] ?? [];
      setParts({ ...parts, [lineId]: list.some(p => p.id === part.id) ? list.map(p => (p.id === part.id ? part : p)) : [...list, part] });
    },
    patchPart: (lineId: string, id: string, patch: Partial<StockPart>) =>
      setParts({ ...parts, [lineId]: (parts[lineId] ?? []).map(p => (p.id === id ? { ...p, ...patch } : p)) }),
    removePart: (lineId: string, id: string) => setParts({ ...parts, [lineId]: (parts[lineId] ?? []).filter(p => p.id !== id) }),
  };
}

// ── Stock maths ──
export const onHand = (p: StockPart) => Math.max(0, (p.received ?? 0) - p.taken + p.returned);
export const available = (p: StockPart) => Math.max(0, onHand(p) - p.reserved);
export const used = (p: StockPart) => Math.max(0, p.taken - p.returned);
/** On hand as a share of what was received. */
export const remainingPct = (p: StockPart) => (p.received ? Math.round((onHand(p) / p.received) * 100) : 0);
/** Pieces at which to reorder: reorderAt % of target. */
export const reorderPcs = (p: StockPart) => Math.ceil((p.target * p.reorderAt) / 100);
/** Quantity to order to get back to target, once at or below the reorder point. */
export const toOrder = (p: StockPart) => (p.received != null && available(p) <= reorderPcs(p) ? Math.max(0, p.target - available(p)) : 0);

export function partStatus(p: StockPart): PartStatus {
  if (p.received == null) return 'pending';
  const a = available(p);
  if (a <= 0) return 'out';
  const at = reorderPcs(p);
  if (a <= at) return 'reorder';
  if (a <= at * 1.5) return 'watch';
  return 'healthy';
}
