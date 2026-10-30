'use client';

import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowDownUp, Copy, Ellipsis, Mail, Search, UserRoundPlus, X } from 'lucide-react';
import { Select as FilterSelect } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

export interface SalesRepRow {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  sales_region_id: string | null;
  created_at: string | null;
  /** Distinct projects this rep owns (Opportunities they own + CRM leads assigned to them). */
  project_count: number;
}

export interface RegionClient {
  id: string;
  name: string;
  code: string | null;
}

interface Props {
  reps: SalesRepRow[];
  regionClients: RegionClient[];
  nextNumber: number;
}

type SortKey = 'newest' | 'oldest' | 'name';

// Figma "Sales team" (node 299:12046).
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const TH = 'px-2.5 text-left text-[12px] font-semibold leading-[1.4] whitespace-nowrap text-ui-body';
// Dropdowns: dark: overrides beat the shared field style's dark padding, border and fill.
const ROW_SELECT = 'inline-flex h-9 w-[233px] max-w-full cursor-pointer items-center gap-4 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-4 pr-2.5 text-[13px] font-medium text-[var(--color-secondary-700)] dark:rounded-[6px] dark:border-[var(--ui-input-border)] dark:bg-ui-input-bg dark:pl-4 dark:pr-2.5 dark:text-ui-heading [&_svg]:size-3.5';
const FORM_SELECT = 'inline-flex h-10 w-full cursor-pointer items-center rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] font-normal text-ui-heading dark:rounded-[6px] dark:border-[var(--ui-input-border)] dark:bg-ui-input-bg dark:text-ui-heading [&_svg]:size-3.5';
const FIELD = 'h-10 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[13px] text-ui-heading outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring';
const MENU_ITEM = 'flex w-full cursor-pointer items-center gap-2 rounded-[4px] border-0 bg-transparent px-2 py-1.5 text-left text-[13px] text-ui-body no-underline hover:bg-ui-hover-bg [&_svg]:size-3.5';

const regionLabel = (c: RegionClient) => `${c.name}${c.code ? ` (${c.code})` : ''}`;
const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US');
};

export function SalesTeamClient({ reps, regionClients, nextNumber }: Props) {
  const router = useRouter();

  const [showInvite, setShowInvite] = useState(false);
  const [savingRegion, setSavingRegion] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [menuId, setMenuId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = reps.filter(r => !q || `${r.full_name} ${r.email}`.toLowerCase().includes(q));
    return [...rows].sort((a, b) => {
      if (sortBy === 'name') return a.full_name.localeCompare(b.full_name);
      const ta = Date.parse(a.created_at ?? '') || 0, tb = Date.parse(b.created_at ?? '') || 0;
      return sortBy === 'oldest' ? ta - tb : tb - ta;
    });
  }, [reps, query, sortBy]);

  async function handleRegionChange(userId: string, newRegionId: string) {
    setSavingRegion(userId);
    try {
      const res = await fetch('/api/sales-team/assign-region', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sales_region_id: newRegionId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update region');
      toast.success('Region updated.');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update region');
    } finally {
      setSavingRegion(null);
    }
  }

  const [nextEdit, setNextEdit] = useState(String(nextNumber));
  const [savingNext, setSavingNext] = useState(false);

  async function handleCounterSave() {
    const val = parseInt(nextEdit, 10);
    if (!Number.isFinite(val) || val < 1) { toast.error('Enter a valid number (1 or more)'); return; }
    setSavingNext(true);
    try {
      const res = await fetch('/api/sales/sequences', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ next_number: val }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Saved — the next project number is ${data.nextNumber}.`);
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to update number'); }
    finally { setSavingNext(false); }
  }

  async function copyEmail(email: string) {
    setMenuId(null);
    try { await navigator.clipboard.writeText(email); toast.success('Email copied'); }
    catch { toast.error('Could not copy'); }
  }

  return (
    <div className="flex flex-col gap-[30px]">
      {/* ── Page heading ── */}
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'Sales', href: '/leads' }, { label: 'Sales Team', href: '/sales-team' }]} />
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Sales Team</h1>
        <p className="m-0 text-[13px] text-ui-body">{reps.length} sales rep{reps.length === 1 ? '' : 's'}</p>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-[380px] max-w-full">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
            <input
              type="search" aria-label="Search sales reps" placeholder="Search reps…"
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
        <button
          type="button" onClick={() => setShowInvite(true)}
          className="inline-flex h-10 items-center gap-2 rounded-[6px] border-0 bg-ui-btn-accent px-8 text-[13px] font-medium leading-[1.35] text-ui-btn-accent-fg transition-opacity hover:opacity-90"
        >
          <UserRoundPlus size={16} aria-hidden />
          Invite to team
        </button>
      </div>

      {/* ── Reps table ── */}
      <div className="overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg">
        {visible.length === 0 ? (
          reps.length === 0 ? (
            <EmptyState
              icon={<UserRoundPlus />}
              title="No sales reps yet"
              description="Invite reps so leads can be assigned to them by region."
            />
          ) : (
            <EmptyState icon={<Search />} title="No matching reps" description="Try another name or email." />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse">
              <thead>
                <tr className="h-[46px] border-b border-ui-divider bg-[var(--ui-table-head-bg,var(--ui-surface))]">
                  <th className={cn(TH, 'w-[264px] pl-[18px]')}>Rep</th>
                  <th className={TH}>Email</th>
                  <th className={cn(TH, 'w-[300px]')}>Region</th>
                  <th className={cn(TH, 'w-[170px]')}>Assigned to</th>
                  <th className={cn(TH, 'w-[150px]')}>Joined Date</th>
                  <th className={cn(TH, 'w-[180px]')}>Status</th>
                  <th className="w-[48px]"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => (
                  <tr key={r.id} className="h-16 border-b border-ui-divider last:border-b-0">
                    <td className="max-w-0 pl-[18px] pr-2.5">
                      <p className={cn('m-0 truncate text-[13px] font-semibold', HEADING)} title={r.full_name}>{r.full_name}</p>
                    </td>
                    <td className="max-w-0 px-2.5">
                      <p className="m-0 truncate text-[13px] text-ui-body" title={r.email}>{r.email}</p>
                    </td>
                    <td className="px-2">
                      <FilterSelect
                        aria-label={`Region for ${r.full_name}`}
                        className={cn(ROW_SELECT, savingRegion === r.id && 'opacity-60')}
                        value={r.sales_region_id ?? ''}
                        disabled={savingRegion === r.id}
                        onValueChange={v => handleRegionChange(r.id, v ?? '')}
                        options={[{ value: '', label: '— Unassigned' }, ...regionClients.map(c => ({ value: c.id, label: regionLabel(c) }))]}
                      />
                    </td>
                    <td className="px-2 text-[12px] whitespace-nowrap text-ui-body">
                      {r.project_count} Project{r.project_count === 1 ? '' : 's'}
                    </td>
                    <td className="px-2 text-[12px] whitespace-nowrap text-ui-body">{fmtDate(r.created_at)}</td>
                    <td className="px-2">
                      <span
                        className="inline-flex h-9 items-center rounded-[4px] border px-8 text-[12px] font-medium leading-4 uppercase"
                        style={r.is_active
                          ? { background: 'var(--status-t9-bg)', color: 'var(--status-t9-fg)', borderColor: 'var(--status-t9-fg)' }
                          : { background: 'var(--status-t0-bg)', color: 'var(--status-t0-fg)', borderColor: 'var(--status-t0-fg)' }}
                      >
                        {r.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="relative pr-2 text-center">
                      <button
                        type="button" aria-label={`Actions for ${r.full_name}`} aria-expanded={menuId === r.id}
                        onClick={() => setMenuId(id => (id === r.id ? null : r.id))}
                        className="inline-grid size-7 place-items-center rounded-[4px] border-0 bg-transparent text-ui-body hover:bg-ui-hover-bg"
                      >
                        <Ellipsis size={16} />
                      </button>
                      {menuId === r.id && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={() => setMenuId(null)} />
                          <div role="menu" className="absolute right-2 top-full z-30 mt-1 w-44 rounded-[6px] border border-ui-divider bg-ui-surface-elevated p-1 text-left shadow-03">
                            <a href={`mailto:${r.email}`} role="menuitem" className={MENU_ITEM} onClick={() => setMenuId(null)}>
                              <Mail aria-hidden /> Send email
                            </a>
                            <button type="button" role="menuitem" className={MENU_ITEM} onClick={() => copyEmail(r.email)}>
                              <Copy aria-hidden /> Copy email
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Project number ── */}
      <section className="flex flex-col gap-3 rounded-[8px] border border-ui-divider bg-ui-page-bg p-3.5">
        <div className="flex flex-col gap-1">
          <h2 className={cn('m-0 text-[16px] font-semibold leading-[1.45]', HEADING)}>Project number</h2>
          <p className="m-0 text-[13px] text-ui-body">
            One running number for <b>all</b> projects (Trust &amp; Sales). The next project uses this number; every project after it increments by 1. Set the starting number here, or correct it if needed.
          </p>
        </div>
        <div className="flex flex-col gap-[7px]">
          <label htmlFor="next-project-number" className="text-[12px] font-medium leading-4 text-ui-body">Next project number</label>
          <div className="flex items-center gap-2.5">
            <input
              id="next-project-number" type="number" min="1" step="1"
              value={nextEdit} onChange={e => setNextEdit(e.target.value)}
              className={cn(FIELD, 'max-w-[160px] font-mono')}
            />
            <button
              type="button"
              disabled={savingNext || nextEdit.trim() === String(nextNumber)}
              onClick={handleCounterSave}
              className="h-10 rounded-[6px] border-0 bg-[var(--color-secondary-700)] px-6 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-primary-50 dark:text-primary-950"
            >
              {savingNext ? 'Saving…' : 'Save'}
            </button>
          </div>
          <p className="m-0 text-[12px] text-ui-text-secondary">
            e.g. set to <b>460</b> → the next project code becomes like <b>STW&nbsp;460</b>, then 461, 462… (the company + region only change the prefix).
          </p>
        </div>
      </section>

      {showInvite && (
        <InviteDialog regionClients={regionClients} onClose={() => setShowInvite(false)} onInvited={() => { setShowInvite(false); router.refresh(); }} />
      )}
    </div>
  );
}

function InviteDialog({ regionClients, onClose, onInvited }: { regionClients: RegionClient[]; onClose: () => void; onInvited: () => void }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [regionId, setRegionId] = useState('');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !fullName.trim()) { toast.error('Name and email are required'); return; }
    setInviting(true);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          full_name: fullName.trim(),
          role: 'sales_rep',
          sales_region_id: regionId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invite failed');
      toast.success(data.alreadyExisted ? 'Existing user re-invited.' : 'Sales rep invited.');
      onInvited();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/45 p-4" onClick={onClose}>
      <form
        role="dialog" aria-modal="true" aria-labelledby="invite-rep-title"
        onClick={e => e.stopPropagation()} onSubmit={handleInvite}
        className="flex w-full max-w-[480px] flex-col gap-4 rounded-card bg-ui-page-bg p-6 shadow-04"
      >
        <div className="flex items-center justify-between">
          <h2 id="invite-rep-title" className={cn('m-0 text-[18px] font-semibold', HEADING)}>Invite to team</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-[6px] border-0 bg-transparent text-ui-body hover:bg-ui-hover-bg">
            <X size={16} />
          </button>
        </div>
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-body">
          Full name
          <input autoFocus required className={FIELD} placeholder="e.g. Jane Doe" value={fullName} onChange={e => setFullName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-body">
          Email
          <input required type="email" className={FIELD} placeholder="jane@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <div className="flex flex-col gap-1.5 text-[12px] font-medium text-ui-body">
          <label htmlFor="new-rep-region">Region</label>
          <FilterSelect
            id="new-rep-region" className={FORM_SELECT}
            value={regionId} onValueChange={v => setRegionId(v ?? '')}
            options={[{ value: '', label: 'No region (assign later)' }, ...regionClients.map(c => ({ value: c.id, label: regionLabel(c) }))]}
          />
        </div>
        <div className="flex justify-end gap-2.5 pt-1">
          <button type="button" onClick={onClose} className={cn('h-9 rounded-[6px] border border-[var(--color-secondary-700)] bg-transparent px-5 text-[13px] font-medium hover:bg-ui-hover-bg dark:border-ui-heading', HEADING)}>
            Cancel
          </button>
          <button type="submit" disabled={inviting || !email.trim() || !fullName.trim()} className="h-9 rounded-[6px] border-0 bg-ui-btn-accent px-6 text-[13px] font-medium text-ui-btn-accent-fg hover:opacity-90 disabled:opacity-50">
            {inviting ? 'Inviting…' : 'Send invite'}
          </button>
        </div>
      </form>
    </div>
  );
}
