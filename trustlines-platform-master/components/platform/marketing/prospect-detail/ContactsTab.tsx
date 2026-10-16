'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Star, Pencil, Trash2 } from 'lucide-react';
import { ContactForm } from './ContactForm';
import type { Contact } from './types';

export function ContactsTab({
  contacts, canEdit, addingContact, setAddingContact, editingContactId, setEditingContactId,
  onSave, onUpdate, onDelete,
}: {
  contacts: Contact[];
  canEdit?: boolean;
  addingContact: boolean;
  setAddingContact: Dispatch<SetStateAction<boolean>>;
  editingContactId: string | null;
  setEditingContactId: (id: string | null) => void;
  onSave: (payload: Record<string, unknown>) => Promise<boolean>;
  onUpdate: (id: string, payload: Record<string, unknown>) => Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      {canEdit && (
        <div style={{ marginBottom: 12 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setAddingContact(s => !s)}>+ Add contact</button>
        </div>
      )}
      {addingContact && canEdit && (
        <div style={{ marginBottom: 12 }}>
          <ContactForm onSave={onSave} onCancel={() => setAddingContact(false)} />
        </div>
      )}
      {contacts.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 32, color: 'var(--fg-subtle)' }}>
          No contacts yet.
        </div></div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {contacts.map(c => {
            if (editingContactId === c.id) {
              return <ContactForm key={c.id} initial={c} onSave={payload => onUpdate(c.id, payload)} onCancel={() => setEditingContactId(null)} />;
            }
            return (
            <div key={c.id} className="card"><div className="card-body">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {c.name}
                    {c.is_primary && <Star size={12} style={{ color: 'var(--status-warning-fg, #92400e)' }} />}
                    {c.is_decision_maker && <span className="pill" style={{ background: 'var(--status-info-bg)', color: 'var(--status-info)', fontSize: 10 }}>Decision maker</span>}
                    {c.whatsapp && <span className="pill" style={{ background: 'var(--status-success-bg)', color: 'var(--status-success)', fontSize: 10 }}>WhatsApp</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>{[c.title, c.role_type].filter(Boolean).join(' · ') || '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>{[c.email, c.phone].filter(Boolean).join(' · ') || '—'}</div>
                  {c.preferred_contact_method && <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)' }}>Prefers: {c.preferred_contact_method}</div>}
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingContactId(c.id)}><Pencil size={12} /> Edit</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => onDelete(c.id)}><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
            </div></div>
            );
          })}
        </div>
      )}
    </div>
  );
}
