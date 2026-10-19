'use client';

import { useState } from 'react';
import { Star, ShieldCheck, Pencil, Trash2, Plus, Users } from 'lucide-react';
import { Select } from '@/components/platform/shared/Select';
import { ROLE_TYPES, type Contact } from './types';
import { EmptyState } from '@/components/ui/empty-state';

export function ContactsCard({ contacts, canEdit, onSave, onDelete }: {
  contacts: Contact[];
  canEdit?: boolean;
  onSave: (payload: Partial<Contact>, contactId?: string) => Promise<boolean>;
  onDelete: (contactId: string, name: string) => void;
}) {
  const [addingContact, setAddingContact] = useState(false);
  const [editContactId, setEditContactId] = useState<string | null>(null);

  async function save(payload: Partial<Contact>, contactId?: string): Promise<boolean> {
    const ok = await onSave(payload, contactId);
    if (ok) { setAddingContact(false); setEditContactId(null); }
    return ok;
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="form-section-title">Contacts ({contacts.length})</div>
        {canEdit && !addingContact && <button className="btn btn-ghost btn-sm" onClick={() => setAddingContact(true)}><Plus size={13} /> Add contact</button>}
      </div>
      <div className="card-body">
        {addingContact && canEdit && (
          <div style={{ marginBottom: 12 }}>
            <ContactForm onSave={p => save(p)} onCancel={() => setAddingContact(false)} />
          </div>
        )}
        {contacts.length === 0 && !addingContact ? (
          <EmptyState size="sm" icon={<Users />} title="No contacts yet." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {contacts.map(ct => editContactId === ct.id && canEdit ? (
              <ContactForm key={ct.id} contact={ct} onSave={p => save(p, ct.id)} onCancel={() => setEditContactId(null)} />
            ) : (
              <div key={ct.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{ct.name}</span>
                    {ct.is_primary && <span title="Primary contact" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#b45309' }}><Star size={11} fill="#f59e0b" stroke="#f59e0b" /> Primary</span>}
                    {ct.is_authorized_approver && <span title="Authorized approver" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--brand-teal, #0d9488)' }}><ShieldCheck size={11} /> Approver</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 2 }}>
                    {[ct.title || ct.role_type, ct.email, ct.phone].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px' }} onClick={() => setEditContactId(ct.id)} aria-label="Edit contact"><Pencil size={13} /></button>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px', color: '#dc2626' }} onClick={() => onDelete(ct.id, ct.name)} aria-label="Remove contact"><Trash2 size={13} /></button>
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

function ContactForm({ contact, onSave, onCancel }: { contact?: Contact; onSave: (p: Partial<Contact>) => Promise<boolean>; onCancel: () => void }) {
  const [f, setF] = useState({
    name: contact?.name ?? '', title: contact?.title ?? '', role_type: contact?.role_type ?? '',
    email: contact?.email ?? '', phone: contact?.phone ?? '',
    is_primary: contact?.is_primary ?? false, is_authorized_approver: contact?.is_authorized_approver ?? false,
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!f.name.trim()) return;
    setSaving(true);
    const ok = await onSave({
      name: f.name.trim(), title: f.title.trim() || null, role_type: f.role_type || null,
      email: f.email.trim() || null, phone: f.phone.trim() || null,
      is_primary: f.is_primary, is_authorized_approver: f.is_authorized_approver,
    } as Partial<Contact>);
    setSaving(false);
    if (!ok) return;
  }

  return (
    <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '12px 14px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div><label className="form-label required" style={{ fontSize: 11 }}>Name</label><input className="form-input" style={{ fontSize: 13 }} value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} autoFocus /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Title</label><input className="form-input" style={{ fontSize: 13 }} placeholder="e.g. Owner" value={f.title} onChange={e => setF(p => ({ ...p, title: e.target.value }))} /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Role</label>
          <Select className="form-input" style={{ fontSize: 13 }} value={f.role_type} onChange={e => setF(p => ({ ...p, role_type: e.target.value }))}>
            <option value="">—</option>
            {ROLE_TYPES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
          </Select></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div><label className="form-label" style={{ fontSize: 11 }}>Email</label><input className="form-input" style={{ fontSize: 13 }} type="email" value={f.email} onChange={e => setF(p => ({ ...p, email: e.target.value }))} /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Phone</label><input className="form-input" style={{ fontSize: 13 }} value={f.phone} onChange={e => setF(p => ({ ...p, phone: e.target.value }))} /></div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={f.is_primary} onChange={e => setF(p => ({ ...p, is_primary: e.target.checked }))} /> Primary contact
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={f.is_authorized_approver} onChange={e => setF(p => ({ ...p, is_authorized_approver: e.target.checked }))} /> Authorized approver
        </label>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={!f.name.trim() || saving}>{saving ? 'Saving…' : (contact ? 'Save' : 'Add')}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
