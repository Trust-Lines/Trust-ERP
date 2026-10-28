'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Select } from '@/components/platform/shared/Select';
import { cn } from '@/lib/utils';
import type { Customer } from './types';
import { DetailCard, HEADING } from './ui';

export function DetailsCard({ customer, editing, onSave, onCancel }: {
  customer: Customer; editing: boolean; onSave: (p: Partial<Customer>) => Promise<void>; onCancel: () => void;
}) {
  return (
    <DetailCard title="Details" muted>
      <DetailList customer={customer} />
      {editing && <EditDialog customer={customer} onSave={onSave} onCancel={onCancel} />}
    </DetailCard>
  );
}

function DetailList({ customer }: { customer: Customer }) {
  // Short single values read larger (14px); free-text ones (Tax ID, Notes) wrap at 13px.
  const rows: [string, string | null, boolean][] = [
    ['Industry', customer.industry, false], ['Email', customer.email, false], ['Phone', customer.phone, false],
    ['Website', customer.website, false], ['Tax ID', customer.tax_id, true], ['Notes', customer.notes, true],
  ];
  return (
    <dl className="m-0 flex flex-col gap-4">
      {rows.map(([k, v, small]) => (
        <div key={k} className="flex min-w-0 flex-col">
          <dt className="text-[12px] font-medium leading-4 text-ui-body">{k}</dt>
          <dd className={cn('m-0 break-words', small ? 'text-[13px] leading-[1.4]' : 'text-[14px] font-medium leading-[1.5] tracking-[-0.308px]', v ? HEADING : 'text-ui-text-disabled')}>
            {v || '—'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function EditDialog({ customer, onSave, onCancel }: { customer: Customer; onSave: (p: Partial<Customer>) => Promise<void>; onCancel: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/45 p-4" onClick={onCancel}>
      <div
        role="dialog" aria-modal="true" aria-labelledby="edit-customer-title" onClick={e => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-[680px] flex-col gap-4 overflow-y-auto rounded-card bg-ui-page-bg p-6 shadow-04"
      >
        <div className="flex items-center justify-between">
          <h2 id="edit-customer-title" className={cn('m-0 text-[18px] font-semibold', HEADING)}>Edit customer</h2>
          <button type="button" onClick={onCancel} aria-label="Close" className="grid size-8 place-items-center rounded-[6px] border-0 bg-transparent text-ui-body hover:bg-ui-hover-bg">
            <X size={16} />
          </button>
        </div>
        <CustomerEditForm customer={customer} onSave={onSave} onCancel={onCancel} />
      </div>
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
