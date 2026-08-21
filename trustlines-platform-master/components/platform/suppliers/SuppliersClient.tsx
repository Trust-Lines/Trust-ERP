'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Package, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { CurrencyTotals } from '@/lib/suppliers/config';
import { CURRENCIES } from '@/lib/suppliers/config';

export interface SupplierRow {
  id: string;
  code: string | null;
  name: string;
  country: string;
  is_active: boolean;
  email: string | null;
  phone: string | null;
  created_at: string;
  totals: CurrencyTotals;
}

interface Props {
  initialSuppliers: SupplierRow[];
  canEdit: boolean;
  schemaError: string | null;
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function BalanceCell({ totals }: { totals: CurrencyTotals }) {
  const active = CURRENCIES.filter(c => totals[c].invoiced !== 0 || totals[c].paid !== 0);
  if (!active.length) return <span style={{ color: 'var(--fg-subtle)' }}>—</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {active.map(c => {
        const bal = totals[c].balance;
        return (
          <span key={c} style={{ fontVariantNumeric: 'tabular-nums', color: bal > 0.005 ? 'var(--status-warning-fg, #92400e)' : 'var(--status-success-fg)' }}>
            {fmt(bal)} <small style={{ color: 'var(--fg-subtle)' }}>{c}</small>
          </span>
        );
      })}
    </div>
  );
}

export function SuppliersClient({ initialSuppliers, canEdit, schemaError }: Props) {
  const router = useRouter();
  const suppliers = initialSuppliers;
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [country, setCountry] = useState('TR');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(q) || (s.code ?? '').toLowerCase().includes(q));
  }, [suppliers, query]);

  async function handleCreate() {
    if (!name.trim()) { toast.error('Supplier name is required'); return; }
    setSaving(true);
    const res = await fetch('/api/suppliers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code, country }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { toast.error(body.error ?? 'Failed to create supplier'); return; }
    toast.success(`Supplier "${name}" created`);
    setShowForm(false); setName(''); setCode(''); setCountry('TR');
    router.refresh();
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Suppliers &amp; finance</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
            {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} · vendor invoices &amp; payments
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
            <Plus size={15} /> New supplier
          </button>
        )}
      </div>

      {schemaError && (
        <div className="card" style={{ padding: 12, marginBottom: 16, borderColor: 'var(--status-warning-fg, #92400e)', fontSize: 13 }}>
          ⚠️ {schemaError}
        </div>
      )}

      {showForm && canEdit && (
        <div className="card" style={{ padding: 16, marginBottom: 16, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
            Name
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Supplier name" autoFocus />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
            Code (optional)
            <input className="form-input" value={code} onChange={e => setCode(e.target.value)} placeholder="AUTO" />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
            Country
            <input className="form-input" value={country} onChange={e => setCountry(e.target.value)} />
          </label>
          <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>{saving ? 'Saving…' : 'Create'}</button>
        </div>
      )}

      <div style={{ position: 'relative', marginBottom: 16, maxWidth: 340 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--fg-subtle)' }} />
        <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Search suppliers…" value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--fg-subtle)' }}>
          <Package size={28} style={{ opacity: 0.4 }} />
          <p style={{ margin: '12px 0 0', fontSize: 14 }}>No suppliers yet.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--fg-subtle)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px' }}>Code</th>
                  <th style={{ padding: '10px 14px' }}>Supplier</th>
                  <th style={{ padding: '10px 14px' }}>Country</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Outstanding balance</th>
                  <th style={{ padding: '10px 14px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => router.push(`/suppliers/${s.id}`)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--fg-subtle)' }}>{s.code ?? '—'}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{s.name}</td>
                    <td style={{ padding: '10px 14px' }}>{s.country}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}><BalanceCell totals={s.totals} /></td>
                    <td style={{ padding: '10px 14px' }}>
                      <span className="pill" style={{ fontSize: 10, background: s.is_active ? 'var(--status-success-bg)' : 'var(--bg-sunken)', color: s.is_active ? 'var(--status-success-fg)' : 'var(--fg-subtle)' }}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
