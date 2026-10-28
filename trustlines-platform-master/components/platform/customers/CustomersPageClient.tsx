'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDownUp, Building2, Copy, Ellipsis, ExternalLink, Mail, Plus, Search, UserRoundPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Select as FilterSelect } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface CustomerRow {
  id: string;
  name: string;
  code: string | null;
  industry: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  is_archived: boolean;
  created_at: string;
}

interface Props {
  initialCustomers: CustomerRow[];
  canEdit?: boolean;
}

// Figma "Customers" (node 299:15806): same list language as Sales Team.
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const TH = 'px-2.5 text-left text-[12px] font-semibold leading-[1.4] whitespace-nowrap text-ui-body';
const MENU_ITEM = 'flex w-full cursor-pointer items-center gap-2 rounded-[4px] border-0 bg-transparent px-2 py-1.5 text-left text-[13px] text-ui-body no-underline hover:bg-ui-hover-bg [&_svg]:size-3.5';
const STATUS_TONE: Record<string, string> = { active: 't9', prospect: 't2', inactive: 't0' };

type SortKey = 'newest' | 'oldest' | 'name';

function StatusChip({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 't0';
  return (
    <span
      className="inline-flex h-9 items-center rounded-[4px] border px-8 text-[12px] font-medium uppercase leading-4"
      style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)`, borderColor: `var(--status-${tone}-fg)` }}
    >
      {status}
    </span>
  );
}

export function CustomersPageClient({ initialCustomers, canEdit }: Props) {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerRow[]>(initialCustomers);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [showForm, setShowForm] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = !q ? customers : customers.filter(c =>
      c.name.toLowerCase().includes(q)
      || (c.code ?? '').toLowerCase().includes(q)
      || (c.industry ?? '').toLowerCase().includes(q)
      || (c.email ?? '').toLowerCase().includes(q));
    return [...rows].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      const ta = Date.parse(a.created_at) || 0, tb = Date.parse(b.created_at) || 0;
      return sortBy === 'oldest' ? ta - tb : tb - ta;
    });
  }, [customers, query, sortBy]);

  async function copyEmail(email: string) {
    setMenuId(null);
    try { await navigator.clipboard.writeText(email); toast.success('Email copied'); }
    catch { toast.error('Could not copy'); }
  }

  async function handleCreate(payload: NewCustomer): Promise<boolean> {
    const res = await fetch('/api/customers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body.error ?? 'Failed to create customer'); return false; }
    setCustomers(prev => [...prev, body.customer].sort((a, b) => a.name.localeCompare(b.name)));
    toast.success(`Customer "${payload.name}" created`);
    setShowForm(false);
    return true;
  }

  return (
    <div className="flex flex-col gap-[30px]">
      {/* ── Page heading ── */}
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <p className="m-0 text-[11px] font-semibold text-ui-nav-active">Sales / Customers</p>
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Customers</h1>
        <p className="m-0 text-[13px] text-ui-body">{customers.length} end customer{customers.length !== 1 ? 's' : ''}</p>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-[380px] max-w-full">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
            <input
              type="search" aria-label="Search customers" placeholder="Search customers…"
              value={query} onChange={e => setQuery(e.target.value)}
              className="h-10 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-2.5 text-[13px] leading-[1.45] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
            />
          </div>
          <div className="relative">
            <ArrowDownUp aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-[var(--color-secondary-700)] dark:text-ui-heading" />
            <FilterSelect
              aria-label="Sort"
              className="inline-flex h-10 w-auto cursor-pointer items-center gap-2 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-[34px] pr-3 text-[13px] font-medium text-[var(--color-secondary-700)] dark:rounded-[6px] dark:text-ui-heading [&_svg]:size-3.5"
              value={sortBy}
              onValueChange={v => setSortBy((v ?? 'newest') as SortKey)}
              options={[
                { value: 'newest', label: 'Newest' },
                { value: 'oldest', label: 'Oldest' },
                { value: 'name', label: 'Name A–Z' },
              ]}
            />
          </div>
        </div>
        {canEdit && (
          <button
            type="button" onClick={() => setShowForm(true)}
            className="inline-flex h-10 items-center gap-2 rounded-[6px] border-0 bg-ui-btn-accent px-8 text-[13px] font-medium leading-[1.35] text-ui-btn-accent-fg transition-opacity hover:opacity-90"
          >
            <UserRoundPlus size={16} aria-hidden /> New Customer
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg">
        {customers.length === 0 ? (
          <EmptyState
            icon={<Building2 />}
            title="No customers yet"
            description="Keep each customer's contacts, addresses, meetings and projects together."
            action={canEdit && <Button onClick={() => setShowForm(true)}><Plus /> Add first customer</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Search />} title="No matching customers" description={`Nothing matches “${query}”.`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="h-[46px] border-b border-ui-divider bg-[var(--ui-table-head-bg,var(--ui-surface))]">
                  <th className={cn(TH, 'w-[300px] pl-[18px]')}>Name</th>
                  <th className={cn(TH, 'w-[230px]')}>Industry</th>
                  <th className={TH}>Contact</th>
                  <th className={cn(TH, 'w-[180px]')}>Status</th>
                  <th className="w-[48px]"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const contact = c.email ?? c.phone;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/customers/${c.id}`)}
                      className="h-16 cursor-pointer border-b border-ui-divider transition-colors last:border-b-0 hover:bg-ui-hover-bg/50"
                    >
                      <td className="max-w-0 pl-[18px] pr-2.5">
                        <Link
                          href={`/customers/${c.id}`} onClick={e => e.stopPropagation()}
                          className={cn('block truncate text-[13px] font-semibold no-underline hover:underline', HEADING)}
                        >
                          {c.name}
                        </Link>
                        {c.code && <p className="m-0 truncate font-mono text-[11px] text-ui-text-secondary">{c.code}</p>}
                      </td>
                      <td className="px-2.5 text-[12px] text-ui-body">{c.industry ?? '—'}</td>
                      <td className="max-w-0 px-2.5"><p className="m-0 truncate text-[13px] text-ui-body">{contact ?? '—'}</p></td>
                      <td className="px-2"><StatusChip status={c.status} /></td>
                      <td className="relative pr-2 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          type="button" aria-label={`Actions for ${c.name}`} aria-expanded={menuId === c.id}
                          onClick={() => setMenuId(id => (id === c.id ? null : c.id))}
                          className="inline-grid size-7 place-items-center rounded-[4px] border-0 bg-transparent text-ui-body hover:bg-ui-hover-bg"
                        >
                          <Ellipsis size={16} />
                        </button>
                        {menuId === c.id && (
                          <>
                            <div className="fixed inset-0 z-20" onClick={() => setMenuId(null)} />
                            <div role="menu" className="absolute right-2 top-full z-30 mt-1 w-44 rounded-[6px] border border-ui-divider bg-ui-surface-elevated p-1 text-left shadow-03">
                              <Link href={`/customers/${c.id}`} role="menuitem" className={MENU_ITEM} onClick={() => setMenuId(null)}>
                                <ExternalLink aria-hidden /> Open customer
                              </Link>
                              {c.email && (
                                <>
                                  <a href={`mailto:${c.email}`} role="menuitem" className={MENU_ITEM} onClick={() => setMenuId(null)}>
                                    <Mail aria-hidden /> Send email
                                  </a>
                                  <button type="button" role="menuitem" className={MENU_ITEM} onClick={() => copyEmail(c.email!)}>
                                    <Copy aria-hidden /> Copy email
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && canEdit && <NewCustomerDialog onSave={handleCreate} onClose={() => setShowForm(false)} />}
    </div>
  );
}

function NewCustomerDialog({ onSave, onClose }: { onSave: (c: NewCustomer) => Promise<boolean>; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/45 p-4" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-labelledby="new-customer-title" onClick={e => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-[680px] flex-col gap-6 overflow-y-auto rounded-[8px] border border-ui-divider bg-ui-page-bg p-5 shadow-04"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="new-customer-title" className={cn('m-0 text-[20px] font-semibold leading-[1.45]', HEADING)}>New Customer</h2>
            <p className="m-0 mt-1 text-[13px] text-ui-body">Add an end customer to keep their contacts, addresses, meetings and projects together.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-[6px] border-0 bg-transparent text-ui-body hover:bg-ui-hover-bg">
            <X size={16} />
          </button>
        </div>
        <CustomerForm onSave={onSave} onCancel={onClose} />
      </div>
    </div>
  );
}

export interface NewCustomer {
  name: string; code?: string; industry?: string; email?: string; phone?: string; status?: string; notes?: string;
}

function CustomerForm({ onSave, onCancel }: { onSave: (c: NewCustomer) => Promise<boolean>; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [industry, setIndustry] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('active');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), code: code.trim(), industry: industry.trim(), email: email.trim(), phone: phone.trim(), status, notes: notes.trim() });
    setSaving(false);
  }

  // Same field language as the New lead wizard: 12px label, 42px input, outlined Cancel + dark primary.
  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px_160px]">
        <div>
          <label htmlFor="nc-name" className={FORM_LABEL}>Customer name<span className="text-error-normal" aria-hidden>*</span></label>
          <input id="nc-name" required autoFocus className={FORM_FIELD} placeholder="e.g. ABC Jewelry" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="nc-code" className={FORM_LABEL}>Code</label>
          <input id="nc-code" className={FORM_FIELD} placeholder="e.g. ABCJ" value={code} onChange={e => setCode(e.target.value)} />
        </div>
        <div>
          <label htmlFor="nc-status" className={FORM_LABEL}>Status</label>
          <FilterSelect
            id="nc-status"
            className="h-[42px] min-h-[42px] rounded-[6px] border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] font-medium text-[var(--color-secondary-700)] dark:rounded-[6px] dark:text-ui-heading"
            value={status}
            onValueChange={v => setStatus(v ?? 'active')}
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
          <label htmlFor="nc-industry" className={FORM_LABEL}>Industry</label>
          <input id="nc-industry" className={FORM_FIELD} placeholder="Jeweler, Restaurant…" value={industry} onChange={e => setIndustry(e.target.value)} />
        </div>
        <div>
          <label htmlFor="nc-email" className={FORM_LABEL}>Email</label>
          <input id="nc-email" type="email" className={FORM_FIELD} placeholder="type.." value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="nc-phone" className={FORM_LABEL}>Phone</label>
          <input id="nc-phone" type="tel" className={FORM_FIELD} placeholder="type.." value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
      </div>

      <div>
        <label htmlFor="nc-notes" className={FORM_LABEL}>Notes (optional)</label>
        <textarea
          id="nc-notes" rows={4} placeholder="Type here.." value={notes} onChange={e => setNotes(e.target.value)}
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
          type="submit" disabled={!name.trim() || saving}
          className="inline-flex h-9 items-center rounded-[6px] border-0 bg-[var(--color-secondary-700)] px-8 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-50 dark:text-primary-950"
        >
          {saving ? 'Saving…' : 'Save customer'}
        </button>
      </div>
    </form>
  );
}

const FORM_LABEL = 'mb-[7px] block text-[12px] font-medium leading-4 text-ui-body';
const FORM_FIELD = 'min-h-[42px] w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] text-ui-heading outline-none placeholder:text-ui-text-disabled focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring';
