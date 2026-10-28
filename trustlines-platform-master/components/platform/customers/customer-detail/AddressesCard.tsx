'use client';

import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Select } from '@/components/platform/shared/Select';
import { ADDRESS_TYPES, type Address } from './types';
import { EmptyState } from '@/components/ui/empty-state';
import { AddButton, DetailCard, FORM_BOX, IconAction, PrimaryChip, RowList } from './ui';

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
    <DetailCard
      title={`Addresses (${addresses.length})`}
      action={canEdit && !addingAddress ? <AddButton label="Add Address" onClick={() => setAddingAddress(true)} /> : undefined}
    >
      {addingAddress && canEdit && <AddressForm onSave={p => save(p)} onCancel={() => setAddingAddress(false)} />}
      {addresses.length === 0 && !addingAddress ? (
        <EmptyState size="sm" icon={<MapPin />} title="No addresses yet." />
      ) : addresses.length > 0 && (
        <RowList>
          {addresses.map(a => editAddressId === a.id && canEdit ? (
            <div key={a.id} className="py-3">
              <AddressForm address={a} onSave={p => save(p, a.id)} onCancel={() => setEditAddressId(null)} />
            </div>
          ) : (
            <div key={a.id} className="flex items-start gap-3 px-1 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold capitalize leading-[1.4] text-ui-body">{a.label || a.address_type || 'Address'}</span>
                  {a.is_primary && <PrimaryChip />}
                </div>
                <p className="m-0 break-words text-[11px] leading-[1.4] text-ui-text-secondary">
                  {[a.line1, a.line2, a.city, a.state, a.postal_code, a.country].filter(Boolean).join(', ') || '—'}
                </p>
              </div>
              {canEdit && (
                <div className="flex shrink-0 items-center gap-2">
                  <IconAction kind="delete" label="Remove address" onClick={() => onDelete(a.id)} />
                  <IconAction kind="edit" label="Edit address" onClick={() => setEditAddressId(a.id)} />
                </div>
              )}
            </div>
          ))}
        </RowList>
      )}
    </DetailCard>
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
    <div className={FORM_BOX}>
      <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px]">
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
      <div className="mb-2.5 grid grid-cols-2 gap-2">
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
