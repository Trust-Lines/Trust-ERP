'use client';

import { useState } from 'react';
import { Select } from '@/components/platform/shared/Select';
import type { Customer } from './types';

export function DetailsCard({ customer, editing, onSave, onCancel }: {
  customer: Customer; editing: boolean; onSave: (p: Partial<Customer>) => Promise<void>; onCancel: () => void;
}) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-head"><div className="form-section-title">Details</div></div>
      <div className="card-body">
        {editing
          ? <CustomerEditForm customer={customer} onSave={onSave} onCancel={onCancel} />
          : <DetailGrid customer={customer} />}
      </div>
    </div>
  );
}

function DetailGrid({ customer }: { customer: Customer }) {
  const rows: [string, string | null][] = [
    ['Industry', customer.industry], ['Email', customer.email], ['Phone', customer.phone],
    ['Website', customer.website], ['Tax ID', customer.tax_id], ['Notes', customer.notes],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 8, columnGap: 12, fontSize: 13 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <div style={{ color: 'var(--fg-subtle)' }}>{k}</div>
          <div>{v || <span style={{ color: 'var(--fg-faint)' }}>—</span>}</div>
        </div>
      ))}
    </div>
  );
}

function CustomerEditForm({ customer, onSave, onCancel }: { customer: Customer; onSave: (p: Partial<Customer>) => Promise<void>; onCancel: () => void }) {
  const [f, setF] = useState({
    name: customer.name, code: customer.code ?? '', industry: customer.industry ?? '', email: customer.email ?? '',
    phone: customer.phone ?? '', website: customer.website ?? '', tax_id: customer.tax_id ?? '', status: customer.status, notes: customer.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  async function submit() {
    if (!f.name.trim()) return;
    setSaving(true);
    await onSave({
      name: f.name.trim(), code: f.code.trim() || null, industry: f.industry.trim() || null, email: f.email.trim() || null,
      phone: f.phone.trim() || null, website: f.website.trim() || null, tax_id: f.tax_id.trim() || null, status: f.status, notes: f.notes.trim() || null,
    } as Partial<Customer>);
    setSaving(false);
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 150px', gap: 10, marginBottom: 10 }}>
        <div><label className="form-label required" style={{ fontSize: 12 }}>Name</label><input className="form-input" value={f.name} onChange={set('name')} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Code</label><input className="form-input" value={f.code} onChange={set('code')} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Status</label>
          <Select className="form-input" value={f.status} onChange={set('status')}>
            <option value="active">Active</option><option value="prospect">Prospect</option><option value="inactive">Inactive</option>
          </Select></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label className="form-label" style={{ fontSize: 12 }}>Industry</label><input className="form-input" value={f.industry} onChange={set('industry')} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Email</label><input className="form-input" type="email" value={f.email} onChange={set('email')} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Phone</label><input className="form-input" value={f.phone} onChange={set('phone')} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div><label className="form-label" style={{ fontSize: 12 }}>Website</label><input className="form-input" value={f.website} onChange={set('website')} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Tax ID</label><input className="form-input" value={f.tax_id} onChange={set('tax_id')} /></div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label className="form-label" style={{ fontSize: 12 }}>Notes</label>
        <textarea className="form-input" rows={2} value={f.notes} onChange={set('notes')} style={{ resize: 'vertical' }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={!f.name.trim() || saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
