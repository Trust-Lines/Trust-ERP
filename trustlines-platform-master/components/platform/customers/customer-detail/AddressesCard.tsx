'use client';

import { useState } from 'react';
import { Star, Pencil, Trash2, Plus, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Select } from '@/components/platform/shared/Select';
import { ADDRESS_TYPES, type Address } from './types';
import { EmptyState } from '@/components/ui/empty-state';

export function AddressesCard({ addresses, canEdit, onSave, onDelete }: {
  addresses: Address[];
  canEdit?: boolean;
  onSave: (payload: Partial<Address>, addressId?: string) => Promise<boolean>;
  onDelete: (addressId: string) => void;
}) {
  const [addingAddress, setAddingAddress] = useState(false);
  const [editAddressId, setEditAddressId] = useState<string | null>(null);

  async function save(payload: Partial<Address>, addressId?: string): Promise<boolean> {
    const ok = await onSave(payload, addressId);
    if (ok) { setAddingAddress(false); setEditAddressId(null); }
    return ok;
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="form-section-title">Addresses ({addresses.length})</div>
        {canEdit && !addingAddress && <button className="btn btn-ghost btn-sm" onClick={() => setAddingAddress(true)}><Plus size={13} /> Add address</button>}
      </div>
      <div className="card-body">
        {addingAddress && canEdit && (
          <div style={{ marginBottom: 12 }}><AddressForm onSave={p => save(p)} onCancel={() => setAddingAddress(false)} /></div>
        )}
        {addresses.length === 0 && !addingAddress ? (
          <EmptyState size="sm" icon={<MapPin />} title="No addresses yet." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {addresses.map(a => editAddressId === a.id && canEdit ? (
              <AddressForm key={a.id} address={a} onSave={p => save(p, a.id)} onCancel={() => setEditAddressId(null)} />
            ) : (
              <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{a.label || a.address_type || 'Address'}</span>
                    {a.is_primary && <span title="Primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#b45309' }}><Star size={11} fill="#f59e0b" stroke="#f59e0b" /> Primary</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 2 }}>
                    {[a.line1, a.line2, a.city, a.state, a.postal_code, a.country].filter(Boolean).join(', ') || '—'}
                  </div>
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px' }} onClick={() => setEditAddressId(a.id)} aria-label="Edit address"><Pencil size={13} /></button>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px', color: '#dc2626' }} onClick={() => onDelete(a.id)} aria-label="Remove address"><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AddressForm({ address, onSave, onCancel }: { address?: Address; onSave: (p: Partial<Address>) => Promise<boolean>; onCancel: () => void }) {
  const [f, setF] = useState({
    label: address?.label ?? '', address_type: address?.address_type ?? '', line1: address?.line1 ?? '', line2: address?.line2 ?? '',
    city: address?.city ?? '', state: address?.state ?? '', postal_code: address?.postal_code ?? '', country: address?.country ?? '',
    is_primary: address?.is_primary ?? false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  async function submit() {
    if (!f.line1.trim() && !f.city.trim()) { toast.error('Enter at least a street or city'); return; }
    setSaving(true);
    const ok = await onSave({
      label: f.label.trim() || null, address_type: f.address_type || null, line1: f.line1.trim() || null, line2: f.line2.trim() || null,
      city: f.city.trim() || null, state: f.state.trim() || null, postal_code: f.postal_code.trim() || null, country: f.country.trim() || null,
      is_primary: f.is_primary,
    } as Partial<Address>);
    setSaving(false);
    if (!ok) return;
  }

  return (
    <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '12px 14px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 8, marginBottom: 8 }}>
        <div><label className="form-label" style={{ fontSize: 11 }}>Label</label><input className="form-input" style={{ fontSize: 13 }} placeholder="e.g. HQ, Store #4" value={f.label} onChange={set('label')} autoFocus /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Type</label>
          <Select className="form-input" style={{ fontSize: 13 }} value={f.address_type} onChange={set('address_type')}>
            <option value="">—</option>{ADDRESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div><label className="form-label" style={{ fontSize: 11 }}>Street</label><input className="form-input" style={{ fontSize: 13 }} value={f.line1} onChange={set('line1')} /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Street 2</label><input className="form-input" style={{ fontSize: 13 }} value={f.line2} onChange={set('line2')} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 110px 1fr', gap: 8, marginBottom: 10 }}>
        <div><label className="form-label" style={{ fontSize: 11 }}>City</label><input className="form-input" style={{ fontSize: 13 }} value={f.city} onChange={set('city')} /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>State</label><input className="form-input" style={{ fontSize: 13 }} value={f.state} onChange={set('state')} /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Postal</label><input className="form-input" style={{ fontSize: 13 }} value={f.postal_code} onChange={set('postal_code')} /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Country</label><input className="form-input" style={{ fontSize: 13 }} value={f.country} onChange={set('country')} /></div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, marginBottom: 10 }}>
        <input type="checkbox" checked={f.is_primary} onChange={e => setF(p => ({ ...p, is_primary: e.target.checked }))} /> Primary address
      </label>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={saving}>{saving ? 'Saving…' : (address ? 'Save' : 'Add')}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
