'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star, ShieldCheck, Pencil, Trash2, Plus, CheckCircle2, Circle, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';

interface Customer {
  id: string; name: string; code: string | null; industry: string | null;
  email: string | null; phone: string | null; website: string | null; tax_id: string | null;
  status: string; notes: string | null; is_archived: boolean; created_at: string; updated_at: string;
}
interface Contact {
  id: string; customer_id: string; name: string; title: string | null; role_type: string | null;
  email: string | null; phone: string | null; is_primary: boolean; is_authorized_approver: boolean;
  notes: string | null; created_at: string;
}

interface Address {
  id: string; customer_id: string; label: string | null; address_type: string | null;
  line1: string | null; line2: string | null; city: string | null; state: string | null;
  postal_code: string | null; country: string | null; is_primary: boolean; notes: string | null; created_at: string;
}
interface ProjectRow { id: string; code: string; name: string; current_stage: string | null; current_phase: string | null; is_draft: boolean }
interface Meeting {
  id: string; title: string; meeting_type: string | null; meeting_at: string;
  location: string | null; attendees: string | null; notes: string | null; outcome: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
}
interface FollowUp {
  id: string; note: string; due_date: string; assignee_id: string | null;
  status: 'open' | 'done' | 'cancelled'; completed_at: string | null;
}
interface Assignee { id: string; full_name: string }

interface Props {
  initialCustomer: Customer;
  initialContacts: Contact[];
  initialAddresses?: Address[];
  initialMeetings?: Meeting[];
  initialFollowUps?: FollowUp[];
  assignees?: Assignee[];
  projects?: ProjectRow[];
  canEdit?: boolean;
}

const MEETING_TYPES = ['discovery', 'site_visit', 'presentation', 'handover', 'other'];
const cap = (s: string) => s.replace(/_/g, ' ');
const todayISO = () => new Date().toISOString().slice(0, 10);

const ROLE_TYPES = ['owner', 'general_manager', 'project_manager', 'architect', 'site_manager', 'purchasing', 'accounting', 'authorized_approver'];

export function CustomerDetailClient({
  initialCustomer, initialContacts, initialAddresses = [],
  initialMeetings = [], initialFollowUps = [], assignees = [],
  projects = [], canEdit,
}: Props) {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer>(initialCustomer);
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [addresses, setAddresses] = useState<Address[]>(initialAddresses);
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings);
  const [followUps, setFollowUps] = useState<FollowUp[]>(initialFollowUps);
  const [addingMeeting, setAddingMeeting] = useState(false);
  const [addingFollowUp, setAddingFollowUp] = useState(false);

  const nameOf = (id: string | null) => (id ? assignees.find(a => a.id === id)?.full_name ?? 'Unknown' : null);

  async function saveMeeting(payload: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/customers/${customer.id}/meetings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body.error ?? 'Failed to save meeting'); return false; }
    setMeetings(p => [body.meeting, ...p].sort((a, b) => b.meeting_at.localeCompare(a.meeting_at)));
    setAddingMeeting(false);
    toast.success('Meeting saved');
    return true;
  }

  async function setMeetingStatus(id: string, status: Meeting['status']) {
    const res = await fetch(`/api/customers/${customer.id}/meetings/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body.error ?? 'Failed'); return; }
    setMeetings(p => p.map(m => m.id === id ? body.meeting : m));
  }

  async function deleteMeeting(id: string) {
    if (!window.confirm('Remove this meeting?')) return;
    const res = await fetch(`/api/customers/${customer.id}/meetings/${id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed to remove'); return; }
    setMeetings(p => p.filter(m => m.id !== id));
    toast.success('Meeting removed');
  }

  async function saveFollowUp(payload: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/customers/${customer.id}/follow-ups`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body.error ?? 'Failed to save follow-up'); return false; }
    setFollowUps(p => [...p, body.followUp].sort((a, b) => a.due_date.localeCompare(b.due_date)));
    setAddingFollowUp(false);
    toast.success('Follow-up added');
    return true;
  }

  async function setFollowUpStatus(id: string, status: FollowUp['status']) {
    const res = await fetch(`/api/customers/${customer.id}/follow-ups/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body.error ?? 'Failed'); return; }
    setFollowUps(p => p.map(f => f.id === id ? body.followUp : f));
  }

  async function deleteFollowUp(id: string) {
    if (!window.confirm('Remove this follow-up?')) return;
    const res = await fetch(`/api/customers/${customer.id}/follow-ups/${id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed to remove'); return; }
    setFollowUps(p => p.filter(f => f.id !== id));
    toast.success('Follow-up removed');
  }
  const [editing, setEditing] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [editContactId, setEditContactId] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [editAddressId, setEditAddressId] = useState<string | null>(null);

  async function saveAddress(payload: Partial<Address>, addressId?: string): Promise<boolean> {
    const url = addressId ? `/api/customers/${customer.id}/addresses/${addressId}` : `/api/customers/${customer.id}/addresses`;
    const res = await fetch(url, { method: addressId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body.error ?? 'Failed to save address'); return false; }
    const saved: Address = body.address;
    setAddresses(prev => {
      const demoted = saved.is_primary ? prev.map(a => ({ ...a, is_primary: a.id === saved.id })) : prev;
      const exists = demoted.some(a => a.id === saved.id);
      const next = exists ? demoted.map(a => a.id === saved.id ? saved : a) : [...demoted, saved];
      return next.sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
    });
    setAddingAddress(false); setEditAddressId(null);
    toast.success(addressId ? 'Address updated' : 'Address added');
    return true;
  }

  async function deleteAddress(addressId: string) {
    if (!window.confirm('Remove this address?')) return;
    const res = await fetch(`/api/customers/${customer.id}/addresses/${addressId}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Failed to remove'); return; }
    setAddresses(prev => prev.filter(a => a.id !== addressId));
    toast.success('Address removed');
  }

  async function saveCustomer(patch: Partial<Customer>) {
    const res = await fetch(`/api/customers/${customer.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body.error ?? 'Failed to update'); return; }
    setCustomer(body.customer);
    setEditing(false);
    toast.success('Customer updated');
  }

  async function deleteCustomer() {
    if (!window.confirm(`Delete "${customer.name}"? This soft-deletes the customer.`)) return;
    const res = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Failed to delete'); return; }
    toast.success('Customer deleted');
    router.push('/customers');
  }

  async function saveContact(payload: Partial<Contact>, contactId?: string): Promise<boolean> {
    const url = contactId ? `/api/customers/${customer.id}/contacts/${contactId}` : `/api/customers/${customer.id}/contacts`;
    const res = await fetch(url, { method: contactId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body.error ?? 'Failed to save contact'); return false; }
    const saved: Contact = body.contact;
    setContacts(prev => {
      const demoted = saved.is_primary ? prev.map(c => ({ ...c, is_primary: c.id === saved.id ? true : false })) : prev;
      const exists = demoted.some(c => c.id === saved.id);
      const next = exists ? demoted.map(c => c.id === saved.id ? saved : c) : [...demoted, saved];
      return next.sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.name.localeCompare(b.name));
    });
    setAddingContact(false); setEditContactId(null);
    toast.success(contactId ? 'Contact updated' : 'Contact added');
    return true;
  }

  async function deleteContact(contactId: string, name: string) {
    if (!window.confirm(`Remove contact "${name}"?`)) return;
    const res = await fetch(`/api/customers/${customer.id}/contacts/${contactId}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? 'Failed to remove'); return; }
    setContacts(prev => prev.filter(c => c.id !== contactId));
    toast.success('Contact removed');
  }

  return (
    <>
      <Link href="/customers" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--fg-subtle)', marginBottom: 16, textDecoration: 'none' }}>
        <ArrowLeft size={14} /> All customers
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>{customer.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--fg-subtle)' }}>
            {customer.code && <span style={{ fontFamily: 'var(--font-mono)' }}>{customer.code}</span>}
            {customer.industry && <span>· {customer.industry}</span>}
            <span className="pill" style={{ fontSize: 10, textTransform: 'capitalize' }}>{customer.status}</span>
          </div>
        </div>
        {canEdit && !editing && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}><Pencil size={13} /> Edit</button>
            <button className="btn btn-ghost btn-sm" style={{ color: '#dc2626' }} onClick={deleteCustomer}><Trash2 size={13} /> Delete</button>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><div className="form-section-title">Details</div></div>
        <div className="card-body">
          {editing
            ? <CustomerEditForm customer={customer} onSave={saveCustomer} onCancel={() => setEditing(false)} />
            : <DetailGrid customer={customer} />}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="form-section-title">Contacts ({contacts.length})</div>
          {canEdit && !addingContact && <button className="btn btn-ghost btn-sm" onClick={() => setAddingContact(true)}><Plus size={13} /> Add contact</button>}
        </div>
        <div className="card-body">
          {addingContact && canEdit && (
            <div style={{ marginBottom: 12 }}>
              <ContactForm onSave={p => saveContact(p)} onCancel={() => setAddingContact(false)} />
            </div>
          )}
          {contacts.length === 0 && !addingContact ? (
            <div style={{ color: 'var(--fg-subtle)', fontSize: 13, padding: '8px 0' }}>No contacts yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {contacts.map(ct => editContactId === ct.id && canEdit ? (
                <ContactForm key={ct.id} contact={ct} onSave={p => saveContact(p, ct.id)} onCancel={() => setEditContactId(null)} />
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
                      <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px', color: '#dc2626' }} onClick={() => deleteContact(ct.id, ct.name)} aria-label="Remove contact"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="form-section-title">Addresses ({addresses.length})</div>
          {canEdit && !addingAddress && <button className="btn btn-ghost btn-sm" onClick={() => setAddingAddress(true)}><Plus size={13} /> Add address</button>}
        </div>
        <div className="card-body">
          {addingAddress && canEdit && (
            <div style={{ marginBottom: 12 }}><AddressForm onSave={p => saveAddress(p)} onCancel={() => setAddingAddress(false)} /></div>
          )}
          {addresses.length === 0 && !addingAddress ? (
            <div style={{ color: 'var(--fg-subtle)', fontSize: 13, padding: '8px 0' }}>No addresses yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {addresses.map(a => editAddressId === a.id && canEdit ? (
                <AddressForm key={a.id} address={a} onSave={p => saveAddress(p, a.id)} onCancel={() => setEditAddressId(null)} />
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
                      <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px', color: '#dc2626' }} onClick={() => deleteAddress(a.id)} aria-label="Remove address"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="form-section-title">Follow-ups ({followUps.filter(f => f.status === 'open').length} open)</div>
          {canEdit && !addingFollowUp && <button className="btn btn-ghost btn-sm" onClick={() => setAddingFollowUp(true)}><Plus size={13} /> Add follow-up</button>}
        </div>
        <div className="card-body">
          {addingFollowUp && canEdit && (
            <div style={{ marginBottom: 12 }}><FollowUpForm assignees={assignees} onSave={saveFollowUp} onCancel={() => setAddingFollowUp(false)} /></div>
          )}
          {followUps.length === 0 && !addingFollowUp ? (
            <div style={{ color: 'var(--fg-subtle)', fontSize: 13, padding: '8px 0' }}>No follow-ups yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {followUps.map(f => {
                const overdue = f.status === 'open' && f.due_date < todayISO();
                return (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 6, opacity: f.status === 'open' ? 1 : 0.6 }}>
                    {canEdit && (
                      <button className="btn btn-ghost btn-sm" style={{ padding: 2 }} aria-label={f.status === 'done' ? 'Reopen follow-up' : 'Mark done'}
                        onClick={() => setFollowUpStatus(f.id, f.status === 'done' ? 'open' : 'done')}>
                        {f.status === 'done'
                          ? <CheckCircle2 size={16} style={{ color: 'var(--status-success-fg, #15803d)' }} />
                          : <Circle size={16} style={{ color: 'var(--fg-faint)' }} />}
                      </button>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, textDecoration: f.status === 'done' ? 'line-through' : 'none' }}>{f.note}</div>
                      <div style={{ fontSize: 12, color: overdue ? '#b91c1c' : 'var(--fg-subtle)', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <CalendarClock size={11} /> {f.due_date}{overdue ? ' · overdue' : ''}
                        {nameOf(f.assignee_id) && <span style={{ color: 'var(--fg-subtle)' }}> · {nameOf(f.assignee_id)}</span>}
                      </div>
                    </div>
                    {canEdit && <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px', color: '#dc2626' }} onClick={() => deleteFollowUp(f.id)} aria-label="Remove follow-up"><Trash2 size={13} /></button>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="form-section-title">Meetings ({meetings.length})</div>
          {canEdit && !addingMeeting && <button className="btn btn-ghost btn-sm" onClick={() => setAddingMeeting(true)}><Plus size={13} /> Add meeting</button>}
        </div>
        <div className="card-body">
          {addingMeeting && canEdit && (
            <div style={{ marginBottom: 12 }}><MeetingForm onSave={saveMeeting} onCancel={() => setAddingMeeting(false)} /></div>
          )}
          {meetings.length === 0 && !addingMeeting ? (
            <div style={{ color: 'var(--fg-subtle)', fontSize: 13, padding: '8px 0' }}>No meetings logged yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {meetings.map(m => (
                <div key={m.id} style={{ padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 6, opacity: m.status === 'cancelled' ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{m.title}</span>
                    {m.meeting_type && <span className="pill" style={{ fontSize: 10, textTransform: 'capitalize' }}>{cap(m.meeting_type)}</span>}
                    <span className="pill" style={{ fontSize: 10, textTransform: 'capitalize',
                      background: m.status === 'completed' ? 'var(--status-success-bg)' : 'var(--bg-sunken)',
                      color: m.status === 'completed' ? 'var(--status-success-fg)' : 'var(--fg-subtle)' }}>{m.status}</span>
                    <div style={{ flex: 1 }} />
                    {canEdit && (
                      <>
                        <select className="form-input" style={{ fontSize: 12, width: 'auto', padding: '2px 6px' }} value={m.status}
                          onChange={e => setMeetingStatus(m.id, e.target.value as Meeting['status'])} aria-label={`${m.title} status`}>
                          <option value="scheduled">Scheduled</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px', color: '#dc2626' }} onClick={() => deleteMeeting(m.id)} aria-label="Remove meeting"><Trash2 size={13} /></button>
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 3 }}>
                    {new Date(m.meeting_at).toLocaleString()}
                    {m.location && ` · ${m.location}`}
                    {m.attendees && ` · ${m.attendees}`}
                  </div>
                  {m.notes && <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 4 }}>{m.notes}</div>}
                  {m.outcome && <div style={{ fontSize: 12, marginTop: 4 }}><strong>Outcome:</strong> {m.outcome}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="form-section-title">Project history ({projects.length})</div></div>
        <div className="card-body" style={{ padding: projects.length ? 0 : undefined }}>
          {projects.length === 0 ? (
            <div style={{ color: 'var(--fg-subtle)', fontSize: 13 }}>
              No linked projects yet. Link this customer to a lead — on delivery the project appears here.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <Link href={`/projects/${p.id}`} style={{ fontWeight: 600 }}>{p.code}</Link>
                      <span style={{ color: 'var(--fg-subtle)', marginLeft: 8 }}>{p.name}</span>
                      {p.is_draft && <span className="pill" style={{ marginLeft: 8, fontSize: 10 }}>Draft</span>}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--fg-subtle)', textTransform: 'capitalize' }}>
                      {(p.current_stage ?? '').replace(/_/g, ' ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
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
          <select className="form-input" value={f.status} onChange={set('status')}>
            <option value="active">Active</option><option value="prospect">Prospect</option><option value="inactive">Inactive</option>
          </select></div>
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

function FollowUpForm({ assignees, onSave, onCancel }: {
  assignees: Assignee[]; onSave: (p: Record<string, unknown>) => Promise<boolean>; onCancel: () => void;
}) {
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState(todayISO());
  const [assigneeId, setAssigneeId] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!note.trim() || !dueDate) return;
    setSaving(true);
    await onSave({ note: note.trim(), due_date: dueDate, assignee_id: assigneeId || null });
    setSaving(false);
  }

  return (
    <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '12px 14px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 180px', gap: 8, marginBottom: 10 }}>
        <div><label className="form-label required" style={{ fontSize: 11 }}>Follow-up</label>
          <input className="form-input" style={{ fontSize: 13 }} placeholder="e.g. Call about layout approval" value={note} onChange={e => setNote(e.target.value)} autoFocus /></div>
        <div><label className="form-label required" style={{ fontSize: 11 }}>Due date</label>
          <input type="date" className="form-input" style={{ fontSize: 13 }} value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Assignee</label>
          <select className="form-input" style={{ fontSize: 13 }} value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
            <option value="">— Unassigned</option>
            {assignees.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
          </select></div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={!note.trim() || !dueDate || saving}>{saving ? 'Saving…' : 'Add follow-up'}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function MeetingForm({ onSave, onCancel }: { onSave: (p: Record<string, unknown>) => Promise<boolean>; onCancel: () => void }) {
  const [f, setF] = useState({
    title: '', meeting_type: '', meeting_at: '', location: '', attendees: '', notes: '', outcome: '', status: 'scheduled',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  async function submit() {
    if (!f.title.trim() || !f.meeting_at) return;
    setSaving(true);
    await onSave({
      title: f.title.trim(), meeting_type: f.meeting_type || null,
      meeting_at: new Date(f.meeting_at).toISOString(),
      location: f.location.trim() || null, attendees: f.attendees.trim() || null,
      notes: f.notes.trim() || null, outcome: f.outcome.trim() || null, status: f.status,
    });
    setSaving(false);
  }

  return (
    <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '12px 14px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 190px', gap: 8, marginBottom: 8 }}>
        <div><label className="form-label required" style={{ fontSize: 11 }}>Title</label>
          <input className="form-input" style={{ fontSize: 13 }} placeholder="e.g. Site visit" value={f.title} onChange={set('title')} autoFocus /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Type</label>
          <select className="form-input" style={{ fontSize: 13 }} value={f.meeting_type} onChange={set('meeting_type')}>
            <option value="">—</option>{MEETING_TYPES.map(t => <option key={t} value={t}>{cap(t)}</option>)}
          </select></div>
        <div><label className="form-label required" style={{ fontSize: 11 }}>Date & time</label>
          <input type="datetime-local" className="form-input" style={{ fontSize: 13 }} value={f.meeting_at} onChange={set('meeting_at')} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 150px', gap: 8, marginBottom: 8 }}>
        <div><label className="form-label" style={{ fontSize: 11 }}>Location</label><input className="form-input" style={{ fontSize: 13 }} value={f.location} onChange={set('location')} /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Attendees</label><input className="form-input" style={{ fontSize: 13 }} placeholder="Names, comma separated" value={f.attendees} onChange={set('attendees')} /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Status</label>
          <select className="form-input" style={{ fontSize: 13 }} value={f.status} onChange={set('status')}>
            <option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
          </select></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div><label className="form-label" style={{ fontSize: 11 }}>Notes</label><textarea className="form-input" rows={2} style={{ fontSize: 13, resize: 'vertical' }} value={f.notes} onChange={set('notes')} /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Outcome</label><textarea className="form-input" rows={2} style={{ fontSize: 13, resize: 'vertical' }} value={f.outcome} onChange={set('outcome')} /></div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={!f.title.trim() || !f.meeting_at || saving}>{saving ? 'Saving…' : 'Save meeting'}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

const ADDRESS_TYPES = ['site', 'billing', 'mailing', 'other'];

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
          <select className="form-input" style={{ fontSize: 13 }} value={f.address_type} onChange={set('address_type')}>
            <option value="">—</option>{ADDRESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select></div>
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
          <select className="form-input" style={{ fontSize: 13 }} value={f.role_type} onChange={e => setF(p => ({ ...p, role_type: e.target.value }))}>
            <option value="">—</option>
            {ROLE_TYPES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
          </select></div>
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
