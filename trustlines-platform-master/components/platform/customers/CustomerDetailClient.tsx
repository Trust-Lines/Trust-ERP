'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { HEADING } from './customer-detail/ui';
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
    if (body.googleError) toast.warning(`Meeting saved, but the Google invite wasn’t sent: ${body.googleError}`, { duration: 10_000 });
    else toast.success(body.meeting?.meet_url ? 'Meeting saved — Google invite with Meet link sent' : 'Meeting saved');
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

  const statusTone = STATUS_TONE[customer.status] ?? 't0';
  const subtitle = [customer.code, customer.industry].filter(Boolean).join(' · ');

  // Figma "Customer detail" (node 304:2563): heading, then a 3-card row
  // (Details · Follow-ups · Project History) over a 3-card row (Contacts · Addresses · Meetings).
  return (
    <div className="mx-auto flex w-full max-w-[1416px] flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-[5px]">
          <Link href="/customers" className="w-fit text-[11px] font-semibold text-ui-nav-active no-underline hover:underline">
            Customers
          </Link>
          <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>{customer.name}</h1>
          <div className="flex items-center gap-[5px] text-[13px] leading-[1.35] text-ui-body">
            {subtitle && <><span>{subtitle}</span><span aria-hidden>·</span></>}
            <span
              className="inline-flex h-5 items-center rounded-[4px] border px-2 text-[12px] font-medium uppercase leading-4"
              style={{ background: `var(--status-${statusTone}-bg)`, color: `var(--status-${statusTone}-fg)`, borderColor: `var(--status-${statusTone}-fg)` }}
            >
              {customer.status}
            </span>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-4">
            <button
              type="button" onClick={deleteCustomer}
              className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-[var(--status-t10-bg)] bg-[var(--status-t10-bg)] pl-3.5 pr-6 text-[13px] font-medium text-[var(--status-t10-fg)] transition-opacity hover:opacity-85"
            >
              <Trash2 size={16} aria-hidden /> Delete
            </button>
            <button
              type="button" onClick={() => setEditing(true)} disabled={editing}
              className="inline-flex h-10 items-center gap-2 rounded-[6px] border-0 bg-[var(--color-secondary-700)] pl-[34px] pr-11 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60 dark:bg-primary-50 dark:text-primary-950"
            >
              <Pencil size={16} aria-hidden /> Edit
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-[325fr_578fr_465fr]">
        <DetailsCard customer={customer} editing={editing} onSave={saveCustomer} onCancel={() => setEditing(false)} />
        <FollowUpsCard followUps={followUps} assignees={assignees} canEdit={canEdit}
          onSave={saveFollowUp} onSetStatus={setFollowUpStatus} onDelete={deleteFollowUp} />
        <ProjectHistoryCard projects={projects} />
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <ContactsCard contacts={contacts} canEdit={canEdit} onSave={saveContact} onDelete={deleteContact} />
        <AddressesCard addresses={addresses} canEdit={canEdit} onSave={saveAddress} onDelete={deleteAddress} />
        <MeetingsCard meetings={meetings} canEdit={canEdit} contactEmails={contacts.map(c => c.email).filter((e): e is string => !!e)}
          onSave={saveMeeting} onSetStatus={setMeetingStatus} onDelete={deleteMeeting} />
      </div>
    </div>
  );
}

const STATUS_TONE: Record<string, string> = { active: 't9', prospect: 't2', inactive: 't0' };
