'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Receipt, Plus, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { TrustExpense } from '@/types/database';
import type { CurrencyTotals } from '@/lib/expenses/config';
import { CURRENCIES, EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from '@/lib/expenses/config';

interface Proj { id: string; code: string; name: string }
interface Sup { id: string; code: string | null; name: string }

interface Props {
  initialExpenses: TrustExpense[];
  totals: CurrencyTotals;
  canEdit: boolean;
  projects: Proj[];
  suppliers: Sup[];
  schemaError: string | null;
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ExpensesClient({ initialExpenses, totals, canEdit, projects, suppliers, schemaError }: Props) {
  const router = useRouter();
  const [expenses] = useState<TrustExpense[]>(initialExpenses);
  const [category, setCategory] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ category: 'other', description: '', currency: 'USD', amount: '', expense_date: '', project_id: '', supplier_id: '', is_paid: false });

  const projById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const supById = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);

  const filtered = useMemo(() => category === 'all' ? expenses : expenses.filter(e => e.category === category), [expenses, category]);
  const activeCurrencies = CURRENCIES.filter(c => totals[c].total !== 0);

  async function create() {
    if (!f.amount || Number(f.amount) <= 0) { toast.error('Enter a positive amount'); return; }
    setSaving(true);
    const res = await fetch('/api/expenses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, amount: Number(f.amount) }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { toast.error(body.error ?? 'Failed'); return; }
    toast.success('Expense recorded'); setShowForm(false);
    setF({ category: 'other', description: '', currency: 'USD', amount: '', expense_date: '', project_id: '', supplier_id: '', is_paid: false });
    router.refresh();
  }

  async function togglePaid(e: TrustExpense) {
    const res = await fetch(`/api/expenses/${e.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_paid: !e.is_paid }) });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Failed'); return; }
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm('Delete this expense?')) return;
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Failed'); return; }
    toast.success('Expense deleted'); router.refresh();
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Trust Expenses</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>{expenses.length} expense{expenses.length !== 1 ? 's' : ''} · internal operational spend</p>
        </div>
        {canEdit && <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}><Plus size={15} /> New expense</button>}
      </div>

      {schemaError && (
        <div className="card" style={{ padding: 12, marginBottom: 16, borderColor: 'var(--status-warning-fg, #92400e)', fontSize: 13 }}>⚠️ {schemaError}</div>
      )}

      {activeCurrencies.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
          {activeCurrencies.map(c => (
            <div key={c} className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginBottom: 8 }}>Total spend ({c})</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(totals[c].total)}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--fg-subtle)', marginTop: 8 }}>
                <span>Paid {fmt(totals[c].paid)}</span>
                <span style={{ color: totals[c].unpaid > 0.005 ? 'var(--status-warning-fg, #92400e)' : undefined }}>Unpaid {fmt(totals[c].unpaid)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && canEdit && (
        <div className="card" style={{ padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 80px 1fr 1fr 1.4fr 1.4fr auto', gap: 8, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 11 }}>Category<select className="form-input" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 11 }}>Cur.<select className="form-input" value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })}>{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 11 }}>Amount<input className="form-input" type="number" step="0.01" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 11 }}>Date<input className="form-input" type="date" value={f.expense_date} onChange={e => setF({ ...f, expense_date: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 11 }}>Project<select className="form-input" value={f.project_id} onChange={e => setF({ ...f, project_id: e.target.value })}><option value="">—</option>{projects.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 11 }}>Supplier<select className="form-input" value={f.supplier_id} onChange={e => setF({ ...f, supplier_id: e.target.value })}><option value="">—</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <button className="btn btn-primary btn-sm" onClick={create} disabled={saving}>{saving ? '…' : 'Save'}</button>
          <label style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center', fontSize: 12 }}>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={f.is_paid} onChange={e => setF({ ...f, is_paid: e.target.checked })} /> Already paid</span>
            <input className="form-input" style={{ flex: 1 }} placeholder="Description (optional)" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
          </label>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <FilterChip label="All" active={category === 'all'} onClick={() => setCategory('all')} />
        {EXPENSE_CATEGORIES.map(c => <FilterChip key={c} label={EXPENSE_CATEGORY_LABELS[c]} active={category === c} onClick={() => setCategory(c)} />)}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--fg-subtle)' }}>
          <Receipt size={28} style={{ opacity: 0.4 }} />
          <p style={{ margin: '12px 0 0', fontSize: 14 }}>No expenses recorded.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--fg-subtle)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px' }}>Date</th>
                  <th style={{ padding: '10px 14px' }}>Category</th>
                  <th style={{ padding: '10px 14px' }}>Description</th>
                  <th style={{ padding: '10px 14px' }}>Project</th>
                  <th style={{ padding: '10px 14px' }}>Supplier</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '10px 14px' }}>Paid</th>
                  {canEdit && <th />}
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const p = e.project_id ? projById.get(e.project_id) : null;
                  const s = e.supplier_id ? supById.get(e.supplier_id) : null;
                  return (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px' }}>{e.expense_date ?? '—'}</td>
                      <td style={{ padding: '10px 14px' }}><span className="pill" style={{ fontSize: 10, background: 'var(--bg-sunken)', color: 'var(--fg-subtle)' }}>{EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}</span></td>
                      <td style={{ padding: '10px 14px', color: 'var(--fg-subtle)' }}>{e.description || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{p ? <Link href={`/projects/${e.project_id}`}>{p.code}</Link> : '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{s ? <Link href={`/suppliers/${e.supplier_id}`}>{s.name}</Link> : '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(e.amount))} <small style={{ color: 'var(--fg-subtle)' }}>{e.currency}</small></td>
                      <td style={{ padding: '10px 14px' }}>
                        {canEdit ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => togglePaid(e)} title={e.is_paid ? 'Mark unpaid' : 'Mark paid'}>
                            <span className="pill" style={{ fontSize: 10, background: e.is_paid ? 'var(--status-success-bg)' : 'var(--bg-sunken)', color: e.is_paid ? 'var(--status-success-fg)' : 'var(--fg-subtle)' }}>
                              {e.is_paid ? <><Check size={10} /> Paid</> : 'Unpaid'}
                            </span>
                          </button>
                        ) : (
                          <span className="pill" style={{ fontSize: 10, background: e.is_paid ? 'var(--status-success-bg)' : 'var(--bg-sunken)', color: e.is_paid ? 'var(--status-success-fg)' : 'var(--fg-subtle)' }}>{e.is_paid ? 'Paid' : 'Unpaid'}</span>
                        )}
                      </td>
                      {canEdit && <td style={{ padding: '10px 14px', textAlign: 'right' }}><button className="btn btn-ghost btn-sm" onClick={() => remove(e.id)} title="Delete"><Trash2 size={14} /></button></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="pill" style={{
      fontSize: 11, cursor: 'pointer', border: '1px solid var(--border)',
      background: active ? 'var(--brand-teal)' : 'transparent',
      color: active ? 'white' : 'var(--fg-subtle)',
    }}>{label}</button>
  );
}
