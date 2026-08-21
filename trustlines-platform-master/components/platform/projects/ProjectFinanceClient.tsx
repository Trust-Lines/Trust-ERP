'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
  finance: ProjectFinance;
  invoices: Inv[];
  payments: Pay[];
  expenses: Exp[];
  suppliers: Sup[];
  approvedCRs?: ApprovedCR[];
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CURS = ['USD', 'TL', 'EUR'] as const;

export function ProjectFinanceClient({ projectId, projectCode, projectName, finance, invoices, payments, expenses, suppliers, approvedCRs = [] }: Props) {
  const supById = new Map(suppliers.map(s => [s.id, s]));
  const supName = (id: string | null) => (id && supById.get(id) ? (supById.get(id)!.code ?? supById.get(id)!.name) : '—');
  const activeSupCur = CURS.filter(c => finance.supplierInvoices[c] !== 0 || finance.supplierPayments[c] !== 0);
  const activeExpCur = CURS.filter(c => finance.trustExpenses[c] !== 0);

  const crDelta = approvedCRs.reduce<Record<string, number>>((acc, cr) => {
    const cur = cr.currency ?? 'USD';
    acc[cur] = (acc[cur] ?? 0) + (cr.budget_impact ?? 0);
    return acc;
  }, {});
  const crDeltaCurs = Object.keys(crDelta).filter(c => crDelta[c] !== 0);

  return (
    <>
      <Link href={`/projects/${projectId}`} className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }}>
        <ArrowLeft size={14} /> Back to project
      </Link>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Project finance</h1>
        <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}><strong>{projectCode}</strong> · {projectName}</p>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>Production (PF value)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          <Metric label="PF total (USD)" value={fmt(finance.production.pfUsd)} />
          <Metric label="PF total (TL)" value={fmt(finance.production.pfTl)} />
          <Metric label="Vendor invoice (USD)" value={fmt(finance.production.invoiceUsd)} />
          <Metric label="Vendor invoice (TL)" value={fmt(finance.production.invoiceTl)} />
          <Metric label="Order expenses (USD)" value={fmt(finance.production.expensesUsd)} />
          <Metric label="Order expenses (TL)" value={fmt(finance.production.expensesTl)} />
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>Approved change requests (budget delta)</h2>
        {approvedCRs.length === 0 ? (
          <p style={{ color: 'var(--fg-subtle)', fontSize: 13, margin: 0 }}>No approved change requests on this project.</p>
        ) : (
          <>
            {crDeltaCurs.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
                {crDeltaCurs.map(c => (
                  <Metric key={c} label={`Approved CR delta (${c})`} value={fmt(crDelta[c])} />
                ))}
              </div>
            )}
            <table className="table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Change request</th>
                  <th style={{ textAlign: 'left' }}>Status</th>
                  <th style={{ textAlign: 'right' }}>Budget impact</th>
                  <th style={{ textAlign: 'right' }}>Schedule</th>
                  <th style={{ textAlign: 'left' }}>Approved</th>
                </tr>
              </thead>
              <tbody>
                {approvedCRs.map(cr => (
                  <tr key={cr.id}>
                    <td>{cr.title}</td>
                    <td style={{ textTransform: 'capitalize' }}>{cr.status}</td>
                    <td style={{ textAlign: 'right' }}>
                      {cr.budget_impact == null ? '—' : `${fmt(cr.budget_impact)} ${cr.currency ?? 'USD'}`}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {cr.timeline_impact_days ? `${cr.timeline_impact_days > 0 ? '+' : ''}${cr.timeline_impact_days}d` : '—'}
                    </td>
                    <td>{cr.resolved_at ? cr.resolved_at.slice(0, 10) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>Supplier invoices &amp; payments (tagged to this project)</h2>
        {activeSupCur.length === 0 ? (
          <p style={{ color: 'var(--fg-subtle)', fontSize: 13, margin: 0 }}>No supplier invoices or payments tagged to this project.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: invoices.length || payments.length ? 16 : 0 }}>
            {activeSupCur.map(c => (
              <div key={c} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginBottom: 6 }}>Balance ({c})</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: finance.supplierBalance[c] > 0.005 ? 'var(--status-warning-fg, #92400e)' : 'var(--status-success-fg)' }}>{fmt(finance.supplierBalance[c])}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--fg-subtle)', marginTop: 6 }}>
                  <span>Inv {fmt(finance.supplierInvoices[c])}</span>
                  <span>Paid {fmt(finance.supplierPayments[c])}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {invoices.length > 0 && (
          <MiniTable
            head={['Invoice #', 'Date', 'Supplier', 'Amount', 'Status']}
            rows={invoices.map(i => [i.invoice_number || '—', i.invoice_date ?? '—', supName(i.supplier_id), `${fmt(Number(i.amount))} ${i.currency}`, i.status])}
          />
        )}
        {payments.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <MiniTable
              head={['Paid', 'Supplier', 'Method', 'Amount']}
              rows={payments.map(p => [p.paid_at ?? '—', supName(p.supplier_id), p.method, `${fmt(Number(p.amount))} ${p.currency}`])}
            />
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>Trust expenses (tagged to this project)</h2>
        {activeExpCur.length === 0 ? (
          <p style={{ color: 'var(--fg-subtle)', fontSize: 13, margin: 0 }}>No Trust expenses tagged to this project.</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: expenses.length ? 16 : 0 }}>
              {activeExpCur.map(c => <Metric key={c} label={`Total (${c})`} value={fmt(finance.trustExpenses[c])} />)}
            </div>
            {expenses.length > 0 && (
              <MiniTable
                head={['Date', 'Category', 'Description', 'Amount', 'Paid']}
                rows={expenses.map(e => [e.expense_date ?? '—', EXPENSE_CATEGORY_LABELS[e.category] ?? e.category, e.description || '—', `${fmt(Number(e.amount))} ${e.currency}`, e.is_paid ? 'Paid' : 'Unpaid'])}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function MiniTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--fg-subtle)', borderBottom: '1px solid var(--border)' }}>
            {head.map((h, i) => <th key={i} style={{ padding: '7px 10px', textAlign: i === head.length - 2 && h === 'Amount' ? 'right' : 'left' }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid var(--border)' }}>
              {r.map((c, ci) => <td key={ci} style={{ padding: '7px 10px', fontVariantNumeric: 'tabular-nums' }}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
