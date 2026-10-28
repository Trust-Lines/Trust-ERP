'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Select as FilterSelect } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Customer } from './types';
import { DetailCard, HEADING } from './ui';

export function DetailsCard({ customer, editing, onSave, onCancel }: {
  customer: Customer; editing: boolean; onSave: (p: Partial<Customer>) => Promise<void>; onCancel: () => void;
}) {
  return (
    <DetailCard title="Details" muted>
      <DetailList customer={customer} />
      {editing && <EditDialog customer={customer} onSave={onSave} onCancel={onCancel} />}
    </DetailCard>
  );
}

function DetailList({ customer }: { customer: Customer }) {
  // Short single values read larger (14px); free-text ones (Tax ID, Notes) wrap at 13px.
  const rows: [string, string | null, boolean][] = [
    ['Industry', customer.industry, false], ['Email', customer.email, false], ['Phone', customer.phone, false],
    ['Website', customer.website, false], ['Tax ID', customer.tax_id, true], ['Notes', customer.notes, true],
  ];
  return (
    <dl className="m-0 flex flex-col gap-4">
      {rows.map(([k, v, small]) => (
        <div key={k} className="flex min-w-0 flex-col">
          <dt className="text-[12px] font-medium leading-4 text-ui-body">{k}</dt>
          <dd className={cn('m-0 break-words', small ? 'text-[13px] leading-[1.4]' : 'text-[14px] font-medium leading-[1.5] tracking-[-0.308px]', v ? HEADING : 'text-ui-text-disabled')}>
            {v || '—'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function EditDialog({ customer, onSave, onCancel }: { customer: Customer; onSave: (p: Partial<Customer>) => Promise<void>; onCancel: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/45 p-4" onClick={onCancel}>
      <div
        role="dialog" aria-modal="true" aria-labelledby="edit-customer-title" onClick={e => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-[680px] flex-col gap-6 overflow-y-auto rounded-[8px] border border-ui-divider bg-ui-page-bg p-5 shadow-04"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="edit-customer-title" className={cn('m-0 text-[20px] font-semibold leading-[1.45]', HEADING)}>Edit Customer</h2>
            <p className="m-0 mt-1 text-[13px] text-ui-body">Update {customer.name}&apos;s details.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="grid size-8 place-items-center rounded-[6px] border-0 bg-transparent text-ui-body hover:bg-ui-hover-bg">
            <X size={16} />
          </button>
        </div>
        <CustomerEditForm customer={customer} onSave={onSave} onCancel={onCancel} />
      </div>
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return;
    setSaving(true);
    await onSave({
      name: f.name.trim(), code: f.code.trim() || null, industry: f.industry.trim() || null, email: f.email.trim() || null,
      phone: f.phone.trim() || null, website: f.website.trim() || null, tax_id: f.tax_id.trim() || null, status: f.status, notes: f.notes.trim() || null,
    } as Partial<Customer>);
    setSaving(false);
  }

  // Same field language as New Customer: 12px label, 42px input, outlined Cancel + dark primary.
  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px_160px]">
        <div>
          <label htmlFor="ec-name" className={FORM_LABEL}>Customer name<span className="text-error-normal" aria-hidden>*</span></label>
          <input id="ec-name" required autoFocus className={FORM_FIELD} value={f.name} onChange={set('name')} />
        </div>
        <div>
          <label htmlFor="ec-code" className={FORM_LABEL}>Code</label>
          <input id="ec-code" className={FORM_FIELD} placeholder="e.g. ABCJ" value={f.code} onChange={set('code')} />
        </div>
        <div>
          <label htmlFor="ec-status" className={FORM_LABEL}>Status</label>
          <FilterSelect
            id="ec-status"
            className="h-[42px] min-h-[42px] rounded-[6px] border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] font-medium text-[var(--color-secondary-700)] dark:rounded-[6px] dark:text-ui-heading"
            value={f.status}
            onValueChange={v => setF(p => ({ ...p, status: v ?? p.status }))}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'prospect', label: 'Prospect' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="ec-industry" className={FORM_LABEL}>Industry</label>
          <input id="ec-industry" className={FORM_FIELD} placeholder="Jeweler, Restaurant…" value={f.industry} onChange={set('industry')} />
        </div>
        <div>
          <label htmlFor="ec-email" className={FORM_LABEL}>Email</label>
          <input id="ec-email" type="email" className={FORM_FIELD} placeholder="type.." value={f.email} onChange={set('email')} />
        </div>
        <div>
          <label htmlFor="ec-phone" className={FORM_LABEL}>Phone</label>
          <input id="ec-phone" type="tel" className={FORM_FIELD} placeholder="type.." value={f.phone} onChange={set('phone')} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ec-website" className={FORM_LABEL}>Website</label>
          <input id="ec-website" className={FORM_FIELD} placeholder="example.com" value={f.website} onChange={set('website')} />
        </div>
        <div>
          <label htmlFor="ec-tax" className={FORM_LABEL}>Tax ID</label>
          <input id="ec-tax" className={FORM_FIELD} placeholder="type.." value={f.tax_id} onChange={set('tax_id')} />
        </div>
      </div>

      <div>
        <label htmlFor="ec-notes" className={FORM_LABEL}>Notes</label>
        <textarea
          id="ec-notes" rows={4} placeholder="Type here.." value={f.notes} onChange={set('notes')}
          className={cn(FORM_FIELD, 'min-h-[104px] resize-y py-3 leading-[1.4]')}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-ui-divider pt-5">
        <button
          type="button" onClick={onCancel}
          className="inline-flex h-9 items-center rounded-[6px] border border-ui-divider bg-ui-input-bg px-8 text-[13px] font-medium text-ui-body transition-colors hover:bg-ui-hover-bg"
        >
          Cancel
        </button>
        <button
          type="submit" disabled={!f.name.trim() || saving}
          className="inline-flex h-9 items-center rounded-[6px] border-0 bg-[var(--color-secondary-700)] px-8 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-50 dark:text-primary-950"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

const FORM_LABEL = 'mb-[7px] block text-[12px] font-medium leading-4 text-ui-body';
const FORM_FIELD = 'min-h-[42px] w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] text-ui-heading outline-none placeholder:text-ui-text-disabled focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring';
