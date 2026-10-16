'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Address, Assignee, Contact, Customer, FollowUp, Meeting, ProjectRow } from './customer-detail/types';
import { DetailsCard } from './customer-detail/DetailsCard';
import { ContactsCard } from './customer-detail/ContactsCard';
import { AddressesCard } from './customer-detail/AddressesCard';
import { FollowUpsCard } from './customer-detail/FollowUpsCard';
import { MeetingsCard } from './customer-detail/MeetingsCard';
import { ProjectHistoryCard } from './customer-detail/ProjectHistoryCard';

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
  const [editing, setEditing] = useState(false);

  async function saveMeeting(payload: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/customers/${customer.id}/meetings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body.error ?? 'Failed to save meeting'); return false; }
    setMeetings(p => [body.meeting, ...p].sort((a, b) => b.meeting_at.localeCompare(a.meeting_at)));
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

      <DetailsCard customer={customer} editing={editing} onSave={saveCustomer} onCancel={() => setEditing(false)} />
      <ContactsCard contacts={contacts} canEdit={canEdit} onSave={saveContact} onDelete={deleteContact} />
      <AddressesCard addresses={addresses} canEdit={canEdit} onSave={saveAddress} onDelete={deleteAddress} />
      <FollowUpsCard followUps={followUps} assignees={assignees} canEdit={canEdit}
        onSave={saveFollowUp} onSetStatus={setFollowUpStatus} onDelete={deleteFollowUp} />
      <MeetingsCard meetings={meetings} canEdit={canEdit}
        onSave={saveMeeting} onSetStatus={setMeetingStatus} onDelete={deleteMeeting} />
      <ProjectHistoryCard projects={projects} />
    </>
  );
}
