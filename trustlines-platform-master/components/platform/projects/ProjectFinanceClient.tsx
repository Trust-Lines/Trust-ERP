'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProjectStage } from '@/types/database';
import { ProjectSubpageHeader, type ProjectSubpage } from './ProjectSubpageHeader';
import type { ProjectFinance } from '@/lib/finance/projectTotals';
import { EXPENSE_CATEGORY_LABELS } from '@/lib/expenses/config';

interface Inv { id: string; supplier_id: string | null; invoice_number: string | null; invoice_date: string | null; currency: string; amount: number; status: string }
interface Pay { id: string; supplier_id: string | null; currency: string; amount: number; paid_at: string | null; method: string }
interface Exp { id: string; category: string; currency: string; amount: number; expense_date: string | null; is_paid: boolean; description: string | null }
interface Sup { id: string; code: string | null; name: string }

export interface ApprovedCR {
  id: string;
  title: string;
  status: string;
  budget_impact: number | null;
  currency: string | null;
  timeline_impact_days: number | null;
  resolved_at: string | null;
}

interface Props {
  projectId: string;
  projectCode: string;
  projectName: string;
  stage?: ProjectStage | null;
  hiddenTabs?: ProjectSubpage[];
  finance: ProjectFinance;
  invoices: Inv[];
  payments: Pay[];
  expenses: Exp[];
  suppliers: Sup[];
  approvedCRs?: ApprovedCR[];
}

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const SYMBOL: Record<string, string> = { USD: '$', TL: '₺', TRY: '₺', EUR: '€' };
const sym = (cur: string | null | undefined) => SYMBOL[(cur ?? 'USD').toUpperCase()] ?? `${cur} `;
/** '$ 25,000' / '₺ 1,250.50' like the frame; zero reads '$ -' on the PF tiles. */
const money = (n: number, cur: string | null | undefined) =>
  `${sym(cur)} ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const dmy = (iso: string | null) => {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};
/** One chip per currency: '$ 25,000 · ₺ 4,000'. Null when every total is zero. */
const totals = (byCur: Record<string, number>) => {
  const parts = Object.entries(byCur).filter(([, v]) => Math.abs(v) > 0.005).map(([c, v]) => money(v, c));
  return parts.length ? parts.join('  ·  ') : null;
};

export function ProjectFinanceClient({ projectId, projectCode, projectName, stage = null, hiddenTabs = [], finance, invoices, payments, expenses, suppliers, approvedCRs = [] }: Props) {
  const supById = new Map(suppliers.map(s => [s.id, s]));
  const supName = (id: string | null) => (id && supById.get(id) ? (supById.get(id)!.name ?? supById.get(id)!.code) : null);

  const crDelta = approvedCRs.reduce<Record<string, number>>((acc, cr) => {
    const cur = cr.currency ?? 'USD';
    acc[cur] = (acc[cur] ?? 0) + (cr.budget_impact ?? 0);
    return acc;
  }, {});

  const pf = finance.production;
  const tiles: [string, number, 'USD' | 'TL'][] = [
    ['PF Total (USD)', pf.pfUsd, 'USD'], ['PF Total (TL)', pf.pfTl, 'TL'],
    ['Vendor Invoice (USD)', pf.invoiceUsd, 'USD'], ['Vendor Invoice (TL)', pf.invoiceTl, 'TL'],
    ['Order Expenses (USD)', pf.expensesUsd, 'USD'], ['Order Expenses (TL)', pf.expensesTl, 'TL'],
  ];

  const supplierRows: Row[] = [
    ...invoices.map(i => ({
      key: `inv-${i.id}`, title: i.invoice_number ? `#${i.invoice_number}` : 'Invoice', amount: money(Number(i.amount), i.currency),
      meta: [dmy(i.invoice_date), supName(i.supplier_id), cap(i.status)].filter(Boolean).join('  ·  '),
      href: i.supplier_id ? `/suppliers/${i.supplier_id}` : null, linkLabel: 'Open supplier',
    })),
    ...payments.map(p => ({
      key: `pay-${p.id}`, title: 'Payment', amount: money(Number(p.amount), p.currency),
      meta: [dmy(p.paid_at), supName(p.supplier_id), cap(p.method)].filter(Boolean).join('  ·  '),
      href: p.supplier_id ? `/suppliers/${p.supplier_id}` : null, linkLabel: 'Open supplier',
    })),
  ];

  return (
    <>
    {/* Same project header + tabs as the other subpages, so switching tabs keeps the project context. */}
    <ProjectSubpageHeader projectId={projectId} code={projectCode} name={projectName} stage={stage} active="finance" hidden={hiddenTabs} />
    <div className="flex flex-col gap-[18px] font-[family-name:var(--font-ui)]">
      {/* Figma "Project Finance" (462:12532): PF tiles, then three list cards. */}

      <section aria-labelledby="finance-pf" className="flex flex-col gap-4 rounded-[8px] border border-ui-divider pt-3.5 pb-5 pl-4 pr-[18px]">
        <h2 id="finance-pf" className={cn('m-0 text-[16px] font-semibold tracking-[0.32px]', HEADING)}>Production (PF Value)</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {tiles.map(([label, value, cur]) => (
            <div key={label} className="flex h-[100px] min-w-0 flex-col justify-between rounded-[8px] py-3.5 pl-4 pr-4"
              style={{ background: 'var(--status-t6-bg)', color: 'var(--status-t6-fg)' }}>
              <span className="truncate text-[14px] leading-[1.5] tracking-[-0.308px]">{label}</span>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[24px] font-semibold leading-[1.5] tracking-[0.48px] tabular-nums" title={money(value, cur)}>
                  {Math.abs(value) > 0.005 ? money(value, cur) : `${sym(cur)} -`}
                </span>
                <span className="shrink-0 rounded-[4px] bg-ui-surface-elevated px-2.5 py-0.5 text-[14px] font-medium leading-[1.5] tracking-[0.56px]">{cur}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <ListCard
          id="finance-cr" title="Approved change requests" sub="(Budget delta)" total={totals(crDelta)}
          empty="No approved change requests on this project."
          rows={approvedCRs.map(cr => ({
            key: cr.id, title: cr.title, amount: cr.budget_impact == null ? null : money(cr.budget_impact, cr.currency),
            meta: [dmy(cr.resolved_at), cap(cr.status),
              cr.timeline_impact_days ? `${cr.timeline_impact_days > 0 ? '+' : ''}${cr.timeline_impact_days}d` : null].filter(Boolean).join('  ·  '),
            href: `/projects/${projectId}/finalization`, linkLabel: 'Open in PM Finalization',
          }))}
        />
        <ListCard
          id="finance-suppliers" title="Supplier invoices & payments" sub="(Tagged to this project)" total={totals(finance.supplierInvoices)}
          totalTitle={`Balance: ${totals(finance.supplierBalance) ?? '—'}  ·  Paid: ${totals(finance.supplierPayments) ?? '—'}`}
          empty="No supplier invoices or payments tagged to this project."
          rows={supplierRows}
        />
        <ListCard
          id="finance-expenses" title="Trust expenses" sub="(Tagged to this project)" total={totals(finance.trustExpenses)}
          empty="No Trust expenses tagged to this project."
          rows={expenses.map(e => ({
            key: e.id, title: EXPENSE_CATEGORY_LABELS[e.category] ?? cap(e.category), amount: money(Number(e.amount), e.currency),
            meta: [dmy(e.expense_date), e.description, e.is_paid ? 'Paid' : 'Unpaid'].filter(Boolean).join('  ·  '),
            href: '/expenses', linkLabel: 'Open expenses',
          }))}
        />
      </div>
    </div>
    </>
  );
}

interface Row { key: string; title: string; amount: string | null; meta: string; href: string | null; linkLabel: string }

const cap = (s: string) => { const t = s.replace(/_/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); };

function AmountChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-[4px] py-1 pl-2 pr-2.5 text-[16px] font-medium leading-4 tabular-nums whitespace-nowrap"
      style={{ background: 'var(--status-t6-bg)', color: 'var(--status-t6-fg)' }}>
      {children}
    </span>
  );
}

function ListCard({ id, title, sub, total, totalTitle, empty, rows }: {
  id: string; title: string; sub: string; total: string | null; totalTitle?: string; empty: string; rows: Row[];
}) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-5 rounded-[8px] border border-ui-divider bg-ui-page-bg px-5 pt-4 pb-5">
      <div className="flex items-center justify-between gap-3 border-b border-ui-divider pb-4">
        <div className="flex min-w-0 flex-col leading-[1.35]">
          <h2 id={id} className={cn('m-0 truncate text-[16px] font-semibold', HEADING)}>{title}</h2>
          <span className="text-[13px] text-ui-text-secondary">{sub}</span>
        </div>
        {total && <span title={totalTitle}><AmountChip>{total}</AmountChip></span>}
      </div>
      {rows.length === 0 ? (
        <p className="m-0 text-[13px] text-ui-text-secondary">{empty}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {rows.map(r => (
            <li key={r.key} className="flex items-center gap-3.5 border-b border-ui-divider px-1 py-3 last:border-b-0">
              <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={cn('truncate text-[16px] font-semibold leading-[1.4]', HEADING)}>{r.title}</span>
                  {r.amount && <AmountChip>{r.amount}</AmountChip>}
                </div>
                <span className="truncate text-[11px] leading-[1.4] text-ui-text-secondary" title={r.meta}>{r.meta}</span>
              </div>
              {r.href && (
                <Link href={r.href} aria-label={`${r.linkLabel}: ${r.title}`} title={r.linkLabel}
                  className="grid size-8 shrink-0 place-items-center rounded-[6px] bg-[var(--color-secondary-700)] text-white no-underline hover:opacity-90 dark:bg-primary-50 dark:text-primary-950">
                  <ExternalLink className="size-4" aria-hidden />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
