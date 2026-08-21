'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { Pill } from '@/components/platform/shared/Pill';

export interface CustomerRow {
  id: string;
  name: string;
  code: string | null;
  industry: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  is_archived: boolean;
  created_at: string;
}

interface Props {
  initialCustomers: CustomerRow[];
  canEdit?: boolean;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'neutral'> = {
  active: 'success', prospect: 'warning', inactive: 'neutral',
};
function StatusPill({ status }: { status: string }) {
  return <Pill variant={STATUS_VARIANT[status] ?? 'neutral'}><span style={{ textTransform: 'capitalize' }}>{status}</span></Pill>;
}

export function CustomersPageClient({ initialCustomers, canEdit }: Props) {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerRow[]>(initialCustomers);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      c.name.toLowerCase().includes(q)
      || (c.code ?? '').toLowerCase().includes(q)
      || (c.industry ?? '').toLowerCase().includes(q));
  }, [customers, query]);

  async function handleCreate(payload: NewCustomer): Promise<boolean> {
    const res = await fetch('/api/customers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body.error ?? 'Failed to create customer'); return false; }
    setCustomers(prev => [...prev, body.customer].sort((a, b) => a.name.localeCompare(b.name)));
    toast.success(`Customer "${payload.name}" created`);
    setShowForm(false);
    return true;
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Customers</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
            {customers.length} end customer{customers.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canEdit && <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>+ New customer</button>}
      </div>

      {showForm && canEdit && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><div className="form-section-title">New customer</div></div>
          <div className="card-body"><CustomerForm onSave={handleCreate} onCancel={() => setShowForm(false)} /></div>
        </div>
      )}

      <div style={{ position: 'relative', marginBottom: 14, maxWidth: 360 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)' }} />
        <input
          className="form-input" style={{ paddingLeft: 32, fontSize: 13 }}
          placeholder="Search customers…" value={query} onChange={e => setQuery(e.target.value)}
          aria-label="Search customers"
        />
      </div>

      {customers.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>
          <Building2 size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <div>No customers yet.{canEdit && ' Click “New customer” to add the first one.'}</div>
        </div></div>
      ) : filtered.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: '32px 24px', color: 'var(--fg-subtle)' }}>
          No customers match “{query}”.
        </div></div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--fg-subtle)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Name</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Industry</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Contact</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/customers/${c.id}`)}
                  style={{ borderTop: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    {c.code && <div style={{ fontSize: 11, color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)' }}>{c.code}</div>}
                  </td>
                  <td style={{ padding: '11px 14px', color: 'var(--fg-subtle)' }}>{c.industry ?? '—'}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--fg-subtle)' }}>{c.email ?? c.phone ?? '—'}</td>
                  <td style={{ padding: '11px 14px' }}><StatusPill status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export interface NewCustomer {
  name: string; code?: string; industry?: string; email?: string; phone?: string; status?: string; notes?: string;
}

function CustomerForm({ onSave, onCancel }: { onSave: (c: NewCustomer) => Promise<boolean>; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [industry, setIndustry] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('active');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), code: code.trim(), industry: industry.trim(), email: email.trim(), phone: phone.trim(), status, notes: notes.trim() });
    setSaving(false);
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 150px', gap: 10, marginBottom: 10 }}>
        <div>
          <label className="form-label required" style={{ fontSize: 12 }}>Customer name</label>
          <input className="form-input" placeholder="e.g. ABC Jewelry" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="form-label" style={{ fontSize: 12 }}>Code</label>
          <input className="form-input" placeholder="e.g. ABCJ" value={code} onChange={e => setCode(e.target.value)} />
        </div>
        <div>
          <label className="form-label" style={{ fontSize: 12 }}>Status</label>
          <select className="form-input" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="prospect">Prospect</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label className="form-label" style={{ fontSize: 12 }}>Industry</label>
          <input className="form-input" placeholder="Jeweler, Restaurant…" value={industry} onChange={e => setIndustry(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Email</label>
          <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Phone</label>
          <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} /></div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label className="form-label" style={{ fontSize: 12 }}>Notes (optional)</label>
        <textarea className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={!name.trim() || saving}>{saving ? 'Saving…' : 'Save customer'}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
