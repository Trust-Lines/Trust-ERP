'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import { Select } from '@/components/platform/shared/Select';
import { ROLE_TYPES, cap, type Contact } from './types';
import { EmptyState } from '@/components/ui/empty-state';
import { AddButton, ApproverChip, DetailCard, FORM_BOX, IconAction, PrimaryChip, RowList } from './ui';

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
    <DetailCard
      title={`Contacts (${contacts.length})`}
      action={canEdit && !addingContact ? <AddButton label="Add Contact" onClick={() => setAddingContact(true)} /> : undefined}
    >
      {addingContact && canEdit && <ContactForm onSave={p => save(p)} onCancel={() => setAddingContact(false)} />}
      {contacts.length === 0 && !addingContact ? (
        <EmptyState size="sm" icon={<Users />} title="No contacts yet." />
      ) : contacts.length > 0 && (
        <RowList>
          {contacts.map(ct => editContactId === ct.id && canEdit ? (
            <div key={ct.id} className="py-3">
              <ContactForm contact={ct} onSave={p => save(p, ct.id)} onCancel={() => setEditContactId(null)} />
            </div>
          ) : (
            <div key={ct.id} className="flex items-start gap-3 px-1 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold leading-[1.4] text-ui-body">{ct.name}</span>
                  {ct.is_primary && <PrimaryChip />}
                  {ct.is_authorized_approver && <ApproverChip />}
                </div>
                <p className="m-0 break-words text-[11px] leading-[1.4] text-ui-text-secondary">
                  {[ct.title || (ct.role_type ? cap(ct.role_type) : null), ct.email, ct.phone].filter(Boolean).join('  ·  ') || '—'}
                </p>
              </div>
              {canEdit && (
                <div className="flex shrink-0 items-center gap-2">
                  <IconAction kind="delete" label={`Remove ${ct.name}`} onClick={() => onDelete(ct.id, ct.name)} />
                  <IconAction kind="edit" label={`Edit ${ct.name}`} onClick={() => setEditContactId(ct.id)} />
                </div>
              )}
            </div>
          ))}
        </RowList>
      )}
    </DetailCard>
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
    <div className={FORM_BOX}>
      <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
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
