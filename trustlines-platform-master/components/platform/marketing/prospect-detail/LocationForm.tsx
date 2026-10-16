'use client';

import { useState } from 'react';
import { type ProspectLocation } from './types';
import { FormShell } from './shared';

export function LocationForm({ initial, onSave, onCancel }: { initial?: ProspectLocation; onSave: (l: Record<string, unknown>) => Promise<boolean>; onCancel: () => void }) {
  const [locationName, setLocationName] = useState(initial?.location_name ?? '');
  const [addressLine1, setAddressLine1] = useState(initial?.address_line_1 ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [state, setState] = useState(initial?.state ?? '');
  const [storeStatus, setStoreStatus] = useState(initial?.store_status ?? '');
  const [mailingAddress, setMailingAddress] = useState(initial?.mailing_address ?? '');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await onSave({
      location_name: locationName.trim(), address_line_1: addressLine1.trim(), city: city.trim(), state: state.trim(),
      store_status: storeStatus.trim(), mailing_address: mailingAddress.trim() || null,
    });
    setSaving(false);
  }

  return (
    <FormShell
      title={initial ? `Edit ${initial.location_name || 'location'}` : 'New location'}
      onCancel={onCancel}
      footer={<>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={saving}>{saving ? 'Saving…' : initial ? 'Save changes' : 'Save location'}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div><label className="form-label" style={{ fontSize: 12 }}>Location name</label>
          <input className="form-input" placeholder="e.g. Flagship store" value={locationName} onChange={e => setLocationName(e.target.value)} autoFocus /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Store status</label>
          <input className="form-input" placeholder="open, planned…" value={storeStatus} onChange={e => setStoreStatus(e.target.value)} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div><label className="form-label" style={{ fontSize: 12 }}>Address</label>
          <input className="form-input" value={addressLine1} onChange={e => setAddressLine1(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>City</label>
          <input className="form-input" value={city} onChange={e => setCity(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>State</label>
          <input className="form-input" value={state} onChange={e => setState(e.target.value)} /></div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label className="form-label" style={{ fontSize: 12 }}>12 - Mailing address</label>
        <input className="form-input" value={mailingAddress} onChange={e => setMailingAddress(e.target.value)} />
      </div>
    </FormShell>
  );
}

