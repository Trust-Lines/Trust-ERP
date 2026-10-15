'use client';

import { useState } from 'react';
import { Select } from '@/components/platform/shared/Select';
import { type Contact } from './types';
import { FormShell } from './shared';

export function ContactForm({ initial, onSave, onCancel }: { initial?: Contact; onSave: (c: Record<string, unknown>) => Promise<boolean>; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [linkedinUrl, setLinkedinUrl] = useState(initial?.linkedin_url ?? '');
  const [otherContact, setOtherContact] = useState(initial?.other_contact ?? '');
  const [company2Phone, setCompany2Phone] = useState(initial?.company2_phone ?? '');
  const [preferredContactMethod, setPreferredContactMethod] = useState(initial?.preferred_contact_method ?? '');
  const [isDecisionMaker, setIsDecisionMaker] = useState(initial?.is_decision_maker ?? false);
  const [isPrimary, setIsPrimary] = useState(initial?.is_primary ?? false);
  const [whatsapp, setWhatsapp] = useState(initial?.whatsapp ?? false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({
      name: name.trim(), title: title.trim(), email: email.trim(), phone: phone.trim(),
      linkedin_url: linkedinUrl.trim(), other_contact: otherContact.trim(), company2_phone: company2Phone.trim(),
      preferred_contact_method: preferredContactMethod, is_decision_maker: isDecisionMaker, is_primary: isPrimary,
      whatsapp,
    });
    setSaving(false);
  }

  return (
    <FormShell
      title={initial ? `Edit ${initial.name}` : 'New contact'}
      onCancel={onCancel}
      footer={<>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={!name.trim() || saving}>{saving ? 'Saving…' : initial ? 'Save changes' : 'Save contact'}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div><label className="form-label required" style={{ fontSize: 12 }}>Name</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Title / Role</label>
          <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div><label className="form-label" style={{ fontSize: 12 }}>Email</label>
          <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Phone</label>
          <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div><label className="form-label" style={{ fontSize: 12 }}>LinkedIn</label>
          <input className="form-input" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Other contact</label>
          <input className="form-input" value={otherContact} onChange={e => setOtherContact(e.target.value)} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div><label className="form-label" style={{ fontSize: 12 }}>Company 2 phone</label>
          <input className="form-input" value={company2Phone} onChange={e => setCompany2Phone(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 12 }}>Preferred contact method</label>
          <Select className="form-input" value={preferredContactMethod} onChange={e => setPreferredContactMethod(e.target.value)}>
            <option value="">—</option>
            <option value="Email">Email</option>
            <option value="Phone">Phone</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Other">Other</option>
          </Select>
        </div>
      </div>
      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0 14px' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
          <input type="checkbox" checked={isDecisionMaker} onChange={e => setIsDecisionMaker(e.target.checked)} /> Decision maker
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
          <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} /> Primary contact
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
          <input type="checkbox" checked={whatsapp} onChange={e => setWhatsapp(e.target.checked)} /> WhatsApp available
        </label>
      </div>
    </FormShell>
  );
}

