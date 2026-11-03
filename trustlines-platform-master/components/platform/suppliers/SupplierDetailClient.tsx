'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, FileText, Wallet, Receipt, Factory } from 'lucide-react';
import { toast } from 'sonner';
import type { Supplier, SupplierInvoice, SupplierPayment } from '@/types/database';
import type { CurrencyTotals } from '@/lib/suppliers/config';
import { CURRENCIES, PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/suppliers/config';
import { Select } from '@/components/platform/shared/Select';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, buttonVariants } from '@/components/ui/button';
import type { VendorWork } from '@/lib/suppliers/trustWork';

interface Props {
  supplier: Supplier;
  initialInvoices: SupplierInvoice[];
  initialPayments: SupplierPayment[];
  totals: CurrencyTotals;
  projects: { id: string; code: string; name: string }[];
  canEdit: boolean;
  /** Its work in the Trust System (lib/suppliers/trustWork); workError = why Trust couldn't be read. */
  work: VendorWork;
  workError: string | null;
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUS_COLOR: Record<string, string> = { unpaid: 'var(--status-danger-fg, #b91c1c)', partial: 'var(--status-warning-fg, #92400e)', paid: 'var(--status-success-fg)' };

export function SupplierDetailClient({ supplier, initialInvoices, initialPayments, totals, projects, canEdit, work, workError }: Props) {
  const router = useRouter();
  const projById = new Map(projects.map(p => [p.id, p]));
  const activeCurrencies = CURRENCIES.filter(c => totals[c].invoiced !== 0 || totals[c].paid !== 0);

  return (
    <>
      <Link href="/suppliers" className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'mb-4 no-underline' })}>
        <ArrowLeft size={14} /> All suppliers
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>{supplier.name}</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
            {supplier.code ?? '—'} · {supplier.country}
            {!supplier.is_active && <span className="pill" style={{ marginLeft: 8, fontSize: 10, background: 'var(--bg-sunken)', color: 'var(--fg-subtle)' }}>Inactive</span>}
          </p>
        </div>
      </div>

      <WorkSection work={work} error={workError} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        {activeCurrencies.length === 0 && (
          <div className="card"><EmptyState size="sm" className="px-4 py-4" icon={<Receipt />} title="No invoices or payments yet." /></div>
        )}
        {activeCurrencies.map(c => (
          <div key={c} className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginBottom: 8 }}>Balance ({c})</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: totals[c].balance > 0.005 ? 'var(--status-warning-fg, #92400e)' : 'var(--status-success-fg)' }}>
              {fmt(totals[c].balance)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--fg-subtle)', marginTop: 8 }}>
              <span>Invoiced {fmt(totals[c].invoiced)}</span>
              <span>Paid {fmt(totals[c].paid)}</span>
            </div>
          </div>
        ))}
      </div>

      <ProfileCard supplier={supplier} canEdit={canEdit} onSaved={() => router.refresh()} />

      <InvoicesSection
        supplierId={supplier.id} invoices={initialInvoices} projById={projById}
        canEdit={canEdit} onChange={() => router.refresh()}
      />

      <PaymentsSection
        supplierId={supplier.id} payments={initialPayments} invoices={initialInvoices}
        projById={projById} canEdit={canEdit} onChange={() => router.refresh()}
      />
    </>
  );
}

function ProfileCard({ supplier, canEdit, onSaved }: { supplier: Supplier; canEdit: boolean; onSaved: () => void }) {
  const [edit, setEdit] = useState(false);
  const router = useRouter();
  const [f, setF] = useState({
    name: supplier.name ?? '', country: supplier.country ?? '',
    email: supplier.email ?? '', phone: supplier.phone ?? '', address: supplier.address ?? '',
    tax_office: supplier.tax_office ?? '', tax_number: supplier.tax_number ?? '',
    payment_terms: supplier.payment_terms ?? '', notes: supplier.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/suppliers/${supplier.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { toast.error(body.error ?? 'Failed to save'); return; }
    toast.success('Supplier updated'); setEdit(false); onSaved();
  }

  // Soft toggle only (is_active) — invoices, payments and history are kept.
  async function toggleActive() {
    const activate = !supplier.is_active;
    if (!activate && !confirm(`Deactivate ${supplier.name}? It will no longer be offered as a vendor. Invoices and payments are kept.`)) return;
    setSaving(true);
    const res = await fetch(`/api/suppliers/${supplier.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: activate }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { toast.error(body.error ?? 'Failed to update supplier'); return; }
    toast.success(activate ? 'Supplier reactivated' : 'Supplier deactivated'); onSaved();
  }

  // Deleted when nothing points at it; otherwise the API sets it inactive and says what's linked.
  async function remove() {
    if (!confirm(`Delete ${supplier.name}? If invoices, payments or production items point at it, it is set inactive instead so they keep their supplier.`)) return;
    setSaving(true);
    const res = await fetch(`/api/suppliers/${supplier.id}`, { method: 'DELETE' });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { toast.error(body.error ?? 'Could not delete the supplier'); return; }
    if (body.deleted) { toast.success(`${supplier.name} deleted`); router.push('/suppliers'); router.refresh(); return; }
    toast.info(`Set inactive instead — linked to ${(body.linked ?? []).join(', ')}`); onSaved();
  }

  const Row = ({ label, value }: { label: string; value: string | null }) => (
    <div style={{ display: 'flex', gap: 8, fontSize: 13, padding: '4px 0' }}>
      <span style={{ color: 'var(--fg-subtle)', minWidth: 120 }}>{label}</span>
      <span>{value || '—'}</span>
    </div>
  );

  return (
    <div className="card" style={{ padding: 16, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Profile</h2>
        {canEdit && !edit && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={toggleActive} disabled={saving}>
              {supplier.is_active ? 'Deactivate' : 'Reactivate'}
            </Button>
            <Button variant="secondary" onClick={() => setEdit(true)}>Edit</Button>
            <Button variant="secondary" onClick={() => void remove()} disabled={saving} style={{ color: 'var(--status-t10-fg)' }}>
              <Trash2 /> Delete
            </Button>
          </div>
        )}
      </div>
      {!edit ? (
        <div>
          <Row label="Email" value={supplier.email} />
          <Row label="Phone" value={supplier.phone} />
          <Row label="Address" value={supplier.address} />
          <Row label="Tax office" value={supplier.tax_office} />
          <Row label="Tax number" value={supplier.tax_number} />
          <Row label="Payment terms" value={supplier.payment_terms} />
          <Row label="Notes" value={supplier.notes} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {([['name', 'Name'], ['country', 'Country'], ['email', 'Email'], ['phone', 'Phone'], ['tax_office', 'Tax office'], ['tax_number', 'Tax number'], ['payment_terms', 'Payment terms']] as const).map(([k, label]) => (
            <label key={k} style={{ display: 'grid', gap: 4, fontSize: 12 }}>
              {label}
              <input className="form-input" value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} />
            </label>
          ))}
          <label style={{ display: 'grid', gap: 4, fontSize: 12, gridColumn: '1 / -1' }}>
            Address
            <input className="form-input" value={f.address} onChange={e => setF({ ...f, address: e.target.value })} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, gridColumn: '1 / -1' }}>
            Notes
            <textarea className="form-input" rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
          </label>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
            <Button onClick={save} loading={saving}>Save</Button>
            <Button variant="secondary" onClick={() => setEdit(false)} disabled={saving}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function InvoicesSection({ supplierId, invoices, projById, canEdit, onChange }: {
  supplierId: string; invoices: SupplierInvoice[]; projById: Map<string, { code: string; name: string }>;
  canEdit: boolean; onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ invoice_number: '', invoice_date: '', currency: 'USD', amount: '', description: '' });
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!f.amount || Number(f.amount) <= 0) { toast.error('Enter a positive amount'); return; }
    setSaving(true);
    const res = await fetch(`/api/suppliers/${supplierId}/invoices`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, amount: Number(f.amount) }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { toast.error(body.error ?? 'Failed'); return; }
    toast.success('Invoice added'); setAdding(false);
    setF({ invoice_number: '', invoice_date: '', currency: 'USD', amount: '', description: '' });
    onChange();
  }

  async function remove(invId: string) {
    if (!confirm('Delete this invoice?')) return;
    const res = await fetch(`/api/suppliers/${supplierId}/invoices/${invId}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Failed'); return; }
    toast.success('Invoice deleted'); onChange();
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={15} /> Invoices ({invoices.length})</h2>
        {canEdit && <Button variant="secondary" onClick={() => setAdding(v => !v)} aria-expanded={adding}><Plus /> Add</Button>}
      </div>

      {adding && canEdit && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px 1fr 2fr auto', gap: 8, alignItems: 'end', marginBottom: 12 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 11 }}>Invoice #<input className="form-input" value={f.invoice_number} onChange={e => setF({ ...f, invoice_number: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 11 }}>Date<input className="form-input" type="date" value={f.invoice_date} onChange={e => setF({ ...f, invoice_date: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 11 }}>Cur.<Select className="form-input" value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })}>{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</Select></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 11 }}>Amount<input className="form-input" type="number" step="0.01" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 11 }}>Description<input className="form-input" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></label>
          <Button onClick={add} loading={saving}>Save</Button>
        </div>
      )}

      {invoices.length === 0 ? (
        <p style={{ color: 'var(--fg-subtle)', fontSize: 13, margin: 0 }}>No invoices recorded.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--fg-subtle)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px 10px' }}>Invoice #</th>
                <th style={{ padding: '8px 10px' }}>Date</th>
                <th style={{ padding: '8px 10px' }}>Project</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '8px 10px' }}>Status</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const p = inv.project_id ? projById.get(inv.project_id) : null;
                return (
                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px' }}>{inv.invoice_number || '—'}{inv.description && <div style={{ color: 'var(--fg-subtle)', fontSize: 11 }}>{inv.description}</div>}</td>
                    <td style={{ padding: '8px 10px' }}>{inv.invoice_date ?? '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{p ? <Link href={`/projects/${inv.project_id}`}>{p.code}</Link> : '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(inv.amount))} <small style={{ color: 'var(--fg-subtle)' }}>{inv.currency}</small></td>
                    <td style={{ padding: '8px 10px' }}><span className="pill" style={{ fontSize: 10, color: STATUS_COLOR[inv.status], background: 'var(--bg-sunken)', textTransform: 'capitalize' }}>{inv.status}</span></td>
                    {canEdit && <td style={{ padding: '8px 10px', textAlign: 'right' }}><Button variant="ghost" size="icon" onClick={() => remove(inv.id)} title="Delete invoice" aria-label="Delete invoice"><Trash2 className="size-4" /></Button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PaymentsSection({ supplierId, payments, invoices, projById, canEdit, onChange }: {
  supplierId: string; payments: SupplierPayment[]; invoices: SupplierInvoice[];
  projById: Map<string, { code: string; name: string }>; canEdit: boolean; onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ amount: '', currency: 'USD', method: 'bank_transfer', paid_at: '', invoice_id: '', reference: '' });
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!f.amount || Number(f.amount) <= 0) { toast.error('Enter a positive amount'); return; }
    setSaving(true);
    const payload = { ...f, amount: Number(f.amount), invoice_id: f.invoice_id || null };
    const res = await fetch(`/api/suppliers/${supplierId}/payments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { toast.error(body.error ?? 'Failed'); return; }
    toast.success('Payment recorded'); setAdding(false);
    setF({ amount: '', currency: 'USD', method: 'bank_transfer', paid_at: '', invoice_id: '', reference: '' });
    onChange();
  }

  async function remove(payId: string) {
    if (!confirm('Delete this payment?')) return;
    const res = await fetch(`/api/suppliers/${supplierId}/payments/${payId}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Failed'); return; }
    toast.success('Payment deleted'); onChange();
  }

  const invLabel = (inv: SupplierInvoice) => `${inv.invoice_number || inv.id.slice(0, 8)} · ${fmt(Number(inv.amount))} ${inv.currency}`;

  return (
    <div className="card" style={{ padding: 16, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}><Wallet size={15} /> Payments ({payments.length})</h2>
        {canEdit && <Button variant="secondary" onClick={() => setAdding(v => !v)} aria-expanded={adding}><Plus /> Add</Button>}
      </div>

      {adding && canEdit && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 1fr 1.4fr auto', gap: 8, alignItems: 'end', marginBottom: 12 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 11 }}>Amount<input className="form-input" type="number" step="0.01" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 11 }}>Cur.<Select className="form-input" value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })}>{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</Select></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 11 }}>Method<Select className="form-input" value={f.method} onChange={e => setF({ ...f, method: e.target.value })}>{PAYMENT_METHODS.map(m => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}</Select></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 11 }}>Date<input className="form-input" type="date" value={f.paid_at} onChange={e => setF({ ...f, paid_at: e.target.value })} /></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 11 }}>Against invoice<Select className="form-input" value={f.invoice_id} onChange={e => setF({ ...f, invoice_id: e.target.value })}><option value="">On account</option>{invoices.map(inv => <option key={inv.id} value={inv.id}>{invLabel(inv)}</option>)}</Select></label>
          <Button onClick={add} loading={saving}>Save</Button>
        </div>
      )}

      {payments.length === 0 ? (
        <p style={{ color: 'var(--fg-subtle)', fontSize: 13, margin: 0 }}>No payments recorded.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--fg-subtle)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px 10px' }}>Date</th>
                <th style={{ padding: '8px 10px' }}>Method</th>
                <th style={{ padding: '8px 10px' }}>Project</th>
                <th style={{ padding: '8px 10px' }}>Reference</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {payments.map(pay => {
                const p = pay.project_id ? projById.get(pay.project_id) : null;
                return (
                  <tr key={pay.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px' }}>{pay.paid_at ?? '—'}</td>
                    <td style={{ padding: '8px 10px' }}>{PAYMENT_METHOD_LABELS[pay.method] ?? pay.method}</td>
                    <td style={{ padding: '8px 10px' }}>{p ? <Link href={`/projects/${pay.project_id}`}>{p.code}</Link> : '—'}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--fg-subtle)' }}>{pay.reference || '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(pay.amount))} <small style={{ color: 'var(--fg-subtle)' }}>{pay.currency}</small></td>
                    {canEdit && <td style={{ padding: '8px 10px', textAlign: 'right' }}><Button variant="ghost" size="icon" onClick={() => remove(pay.id)} title="Delete payment" aria-label="Delete payment"><Trash2 className="size-4" /></Button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// What we've worked on with this supplier in the Trust System: every project type given to it,
// when, and what was paid. PF amounts are what we owe it; paid = the item's paid USD/TL fields.
function WorkSection({ work, error }: { work: VendorWork; error: string | null }) {
  const d = (v: string | null) => (v ? new Date(`${v}T00:00:00`).toLocaleDateString('en-US') : '—');
  const money = (usd: number, tl: number) => [usd && `$${fmt(usd)}`, tl && `${fmt(tl)} TL`].filter(Boolean).join(' · ') || '—';
  const label = (s: string | null) => (s ? s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()) : '—');
  const t = work.totals;
  const stats: [string, string][] = [
    ['Projects', String(work.projects)],
    ['Jobs', String(work.rows.length)],
    ['Worked with', work.firstAt ? `${d(work.firstAt)} – ${d(work.lastAt)}` : '—'],
    ['Total PF', money(t.pfUsd, t.pfTl)],
    ['Paid', money(t.paidUsd, t.paidTl)],
    ['Still to pay', money(t.dueUsd, t.dueTl)],
  ];
  const TH: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 12, fontWeight: 600, color: 'var(--fg-subtle)', whiteSpace: 'nowrap' };
  const TD: React.CSSProperties = { padding: '8px 10px', fontSize: 13, whiteSpace: 'nowrap' };

  return (
    <div className="card" style={{ padding: 16, marginBottom: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Factory size={15} /> Work with this supplier
        <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--fg-subtle)' }}>· from the Trust System Production board</span>
      </h2>
      {error && <p style={{ fontSize: 13, color: 'var(--status-t10-fg)', margin: '0 0 12px' }}>Trust System couldn’t be read: {error}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        {stats.map(([k, v]) => (
          <div key={k} style={{ background: 'var(--bg-sunken)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>{k}</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 2, color: k === 'Still to pay' && (t.dueUsd > 0.005 || t.dueTl > 0.005) ? 'var(--status-warning-fg, #92400e)' : undefined }}>{v}</div>
          </div>
        ))}
      </div>
      {work.rows.length === 0 ? (
        !error && <EmptyState size="sm" icon={<Factory />} title="No work with this supplier in the Trust System yet." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                {['Project', 'Type', 'PF code', 'Status', 'Started', 'Ready', 'Sent', 'Last payment', 'PF', 'Paid', 'Still to pay'].map(h => (
                  <th key={h} style={{ ...TH, textAlign: ['PF', 'Paid', 'Still to pay'].includes(h) ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {work.rows.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ ...TD, whiteSpace: 'normal', minWidth: 200 }}>
                    <span style={{ fontWeight: 600 }}>#{r.projectNo}</span> {r.projectName}
                    {r.projectDone && <span className="pill" style={{ marginLeft: 6, fontSize: 10, background: 'var(--bg-sunken)', color: 'var(--fg-subtle)' }}>Done</span>}
                  </td>
                  <td style={TD}>{label(r.type)}</td>
                  <td style={TD}>{r.pfCode ?? '—'}</td>
                  <td style={TD}>{label(r.status)}</td>
                  <td style={TD}>{d(r.startedAt)}</td>
                  <td style={TD}>{d(r.readyAt)}</td>
                  <td style={TD}>{d(r.sentAt)}</td>
                  <td style={TD}>{d(r.lastPaidAt)}</td>
                  <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(r.pfUsd, r.pfTl)}</td>
                  <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(r.paidUsd, r.paidTl)}</td>
                  <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{money(r.pfUsd - r.paidUsd, r.pfTl - r.paidTl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
