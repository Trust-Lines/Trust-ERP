'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Package, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { CurrencyTotals } from '@/lib/suppliers/config';
import { CURRENCIES } from '@/lib/suppliers/config';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { cn } from '@/lib/utils';

export interface SupplierRow {
  id: string;
  code: string | null;
  name: string;
  country: string;
  is_active: boolean;
  email: string | null;
  phone: string | null;
  created_at: string;
  totals: CurrencyTotals;
}

interface Props {
  initialSuppliers: SupplierRow[];
  canEdit: boolean;
  schemaError: string | null;
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Figma "Suppliers" (node 427:15814). The frame's "Country" filter has no backing feature here.
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const TH = 'px-2.5 text-left text-[12px] font-semibold leading-[1.4] whitespace-nowrap text-ui-body';
const ACCENT_BTN = 'gap-2 bg-ui-btn-accent px-8 text-[13px] font-medium text-ui-btn-accent-fg hover:bg-ui-btn-accent hover:opacity-90 dark:bg-ui-btn-accent dark:text-ui-btn-accent-fg dark:hover:bg-ui-btn-accent';
// Figma table chip: 36px, 1px tone border, 32px side padding, uppercase label.
const STATE_CHIP = 'h-9 gap-1.5 rounded-[4px] border border-current px-8 text-[12px] uppercase leading-4 [&_svg]:size-3.5';
const FIELD = 'h-10 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring';

/** One line per currency in use: "25,000.00 USD". */
function BalanceCell({ totals }: { totals: CurrencyTotals }) {
  const active = CURRENCIES.filter(c => totals[c].invoiced !== 0 || totals[c].paid !== 0);
  if (!active.length) return <span className="text-ui-text-secondary">—</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {active.map(c => (
        <span key={c} className="text-[13px] tabular-nums text-ui-body">
          {fmt(totals[c].balance)} <small className="text-ui-text-secondary">{c}</small>
        </span>
      ))}
    </div>
  );
}

export function SuppliersClient({ initialSuppliers, canEdit, schemaError }: Props) {
  const router = useRouter();
  const suppliers = initialSuppliers;
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [country, setCountry] = useState('TR');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(q) || (s.code ?? '').toLowerCase().includes(q));
  }, [suppliers, query]);

  // The Trust System's Production vendors → Suppliers (adds + updates; app/api/suppliers/sync-trust).
  const [syncing, setSyncing] = useState(false);
  async function syncFromTrust() {
    setSyncing(true);
    try {
      const res = await fetch('/api/suppliers/sync-trust', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not update from Trust'); return; }
      const changed = b.added.length + b.updated.length;
      toast.success(changed ? `${b.added.length} added, ${b.updated.length} updated from Trust` : 'Already up to date with Trust');
      if (changed) router.refresh();
    } catch { toast.error('Could not update from Trust'); }
    finally { setSyncing(false); }
  }

  async function handleCreate() {
    if (!name.trim()) { toast.error('Supplier name is required'); return; }
    setSaving(true);
    const res = await fetch('/api/suppliers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code, country }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { toast.error(body.error ?? 'Failed to create supplier'); return; }
    toast.success(`Supplier "${name}" created`);
    setShowForm(false); setName(''); setCode(''); setCountry('TR');
    router.refresh();
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Suppliers &amp; finance</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', margin: 0 }}>
            {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} · vendor invoices &amp; payments
          </p>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="md" variant="secondary" onClick={() => void syncFromTrust()} disabled={syncing}
              title="Bring in the Trust System's Production vendors (also runs every night)">
              <RefreshCw className={syncing ? 'animate-spin' : undefined} /> Update from Trust
            </Button>
            <Button size="md" onClick={() => setShowForm(v => !v)} aria-expanded={showForm}>
              <Plus /> New supplier
            </Button>
          </div>
        )}
      </div>

      {schemaError && (
        <div className="rounded-[8px] border border-warning-normal bg-ui-surface px-4 py-3 text-[13px] text-ui-body">
          ⚠️ {schemaError}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="relative w-[380px] max-w-full">
          <Search size={16} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
          <input type="search" aria-label="Search suppliers" className={cn(FIELD, 'pl-[34px]')} placeholder="Search suppliers…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {canEdit && (
          <Button size="md" className={ACCENT_BTN} onClick={() => setShowForm(v => !v)} aria-expanded={showForm}>
            <Plus className="size-4" /> New Supplier
          </Button>
        )}
      </div>

      {showForm && canEdit && (
        <div className="grid grid-cols-1 items-end gap-3 rounded-[8px] border border-ui-divider bg-ui-page-bg p-4 md:grid-cols-[2fr_1fr_1fr_auto]">
          <label className="flex flex-col gap-1 text-[12px] font-medium text-ui-body">
            Name
            <input className={FIELD} value={name} onChange={e => setName(e.target.value)} placeholder="Supplier name" autoFocus />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-ui-body">
            Code (optional)
            <input className={FIELD} value={code} onChange={e => setCode(e.target.value)} placeholder="AUTO" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-ui-body">
            Country
            <input className={FIELD} value={country} onChange={e => setCountry(e.target.value)} />
          </label>
          <Button size="md" onClick={handleCreate} loading={saving}>Create</Button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-[8px] border border-ui-divider bg-ui-page-bg">
          {suppliers.length === 0 ? (
            <EmptyState
              icon={<Package />}
              title="No suppliers yet"
              description="Track vendor invoices and payments for each supplier."
              action={canEdit && <Button onClick={() => setShowForm(true)}><Plus /> Add first supplier</Button>}
            />
          ) : (
            <EmptyState icon={<Package />} title="No supplier matches your search" description="Try a different name." />
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse">
              <thead>
                <tr className="h-[46px] border-b border-ui-divider bg-ui-surface">
                  <th className={cn(TH, 'w-[24%] pl-[18px]')}>Code</th>
                  <th className={cn(TH, 'w-[25%]')}>Supplier</th>
                  <th className={cn(TH, 'w-[21%]')}>Country</th>
                  <th className={cn(TH, 'w-[17%]')}>Outstanding Balance</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => router.push(`/suppliers/${s.id}`)}
                    className="h-16 cursor-pointer border-b border-ui-divider last:border-b-0 hover:bg-ui-hover-bg/50"
                  >
                    <td className={cn('max-w-0 truncate py-2 pl-[18px] pr-2.5 text-[15px] font-semibold', HEADING)}>{s.code ?? '—'}</td>
                    <td className="max-w-0 px-2.5 py-2">
                      <Link href={`/suppliers/${s.id}`} onClick={e => e.stopPropagation()} className={cn('block truncate text-[15px] font-semibold no-underline hover:underline', HEADING)}>
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-[13px] text-ui-body">{s.country}</td>
                    <td className="px-2 py-2"><BalanceCell totals={s.totals} /></td>
                    <td className="px-2 py-2">
                      <StatusBadge group="record_state" status={s.is_active ? 'active' : 'inactive'} className={STATE_CHIP} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
