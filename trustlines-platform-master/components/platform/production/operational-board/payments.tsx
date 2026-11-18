'use client';

import { Fragment, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { toNumber, type PItem } from '@/lib/excel/projectsExcelExport';
import { remainderFor, rowAccounting, type RowAccounting } from '@/lib/production/paymentsAccounting';
import type { PayField } from '@/lib/production/paymentFields';
import { shortDate } from './boardStyles';

// ── Payments page (Figma TRUST-LINES ERP "Payments" 935:22284): four cards side by side, 32px
// apart — Project (the board, T10 red), Accounting (T7), Payments Grand Total (T6) and Invoice &
// Receipt (dark grey). They are one table, so every row lines up across the cards; the gaps are
// empty columns. Each card has a title bar (52px) and its column headings (46px); a project's
// band carries white labels (1st / 2nd / Remaining …) in the project's colour, its TOTAL row white
// amount chips. Roles with "Edit payments" type into the paid / date / invoice cells (saved on
// blur through /api/payments/items/:id); everything else is computed (lib/production/paymentsAccounting).
export type PayGroup = 'acc' | 'tl' | 'inv';
type PayKind = 'usd' | 'tl' | 'date' | 'text' | 'qb';
export interface PayCol { key: string; group: PayGroup; label: string; kind: PayKind; w: number; get: (it: PItem, a: RowAccounting) => number | string | null | undefined; field?: PayField }
interface CardTone { title: React.CSSProperties; head: React.CSSProperties }
const cardTone = (t: string, titleBg?: string): CardTone => ({
  title: { background: titleBg ?? `var(--status-${t}-fg)`, color: `var(--status-${t}-bg)` },
  head: { background: `var(--status-${t}-bg)`, color: `var(--status-${t}-fg)` },
});
export const PROJECT_CARD = cardTone('t10');
export const PAY_GROUPS: { group: PayGroup; title: string; total: string; tone: CardTone; pills: [string, number][] }[] = [
  { group: 'acc', title: 'Accounting', total: 'Accounting Grand Total', tone: cardTone('t7'),
    pills: [['1st', 2], ['2nd', 2], ['1st', 2], ['2nd', 2], ['Remaining', 2], ['Not Ordered', 2]] },
  { group: 'tl', title: 'Payments Grand Total', total: 'Payments Grand Total', tone: cardTone('t6'),
    pills: [['Due Payment', 2], ['Payments 1', 2], ['Payments 2', 2]] },
  { group: 'inv', title: 'Invoice & Receipt', total: '', tone: cardTone('t0', 'var(--status-n1-fg)'),
    pills: [['Invoices & Receipts', 4]] },
];
export const PAY_COLS: PayCol[] = [
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
export const TITLE_H = 52;
export const GAP_W = 32;
export const groupCols = (g: PayGroup) => PAY_COLS.filter(c => c.group === g);
export const startsGroup = (i: number) => i === 0 || PAY_COLS[i - 1].group !== PAY_COLS[i].group;
// Dollars in the T6 green, lira in the orange of the design (--pay-usd-fg / --pay-tl-fg).
const moneyFg = (k: PayKind) => (k === 'usd' ? 'var(--pay-usd-fg)' : 'var(--pay-tl-fg)');
const payMoney = (kind: PayKind, n: number) => `${kind === 'usd' ? '$' : '₺'} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const isMoney = (k: PayKind) => k === 'usd' || k === 'tl';
/** The totals of the money columns over some rows. */
export function payTotals(items: PItem[]): Record<string, number> {
  const t: Record<string, number> = {};
  for (const it of items) {
    const a = rowAccounting(it);
    for (const c of PAY_COLS) if (isMoney(c.kind)) t[c.key] = (t[c.key] ?? 0) + toNumber(c.get(it, a) as number);
  }
  return t;
}
/** The empty column between two cards. */
export function Gap({ th }: { th?: boolean }) {
  return th ? <th aria-hidden className="sticky top-0 z-20 border-0 bg-ui-page-bg p-0" /> : <td aria-hidden className="border-0 bg-ui-page-bg p-0" />;
}
// Spreadsheet lines like the Project card: every column has a right border, the card's first
// column also its left edge.
export const edge = (i: number) => cn(startsGroup(i) && 'border-l border-l-ui-divider', 'border-r border-r-ui-divider');
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

/** One board row's cells on the payment cards. */
export function PayCells({ item, edit, onSaved }: { item: PItem; edit: boolean; onSaved: () => void }) {
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
export function PayHeadBand({ style }: { style: React.CSSProperties }) {
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
export function PayBand({ background, top }: { background: string; top: number }) {
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
export function PayTotalCells({ totals, styleOf, labels }: { totals: Record<string, number>; styleOf: (g: PayGroup) => React.CSSProperties; labels?: boolean }) {
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
