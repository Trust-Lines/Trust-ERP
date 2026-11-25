'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDownUp, Copy, Phone, Plus, Search, UserRound } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/modal';
import { PageHeading } from '@/components/platform/shared/PageHeading';
import { PersonFace } from '@/components/ui/avatar-directory';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TOOLBAR_SELECT, TOOLBAR_SORT_ICON } from './ticketStyles';
import { SOLID_CHIP } from './itemStyles';
import { FIELD, MUTED, SORT_OPTIONS, STRONG, copyText, initials, tabClass } from './itCardParts';
import { roleLabel } from '@/components/platform/shell/Sidebar';
import { EMPTY_PHONE, ItPhoneFormDialog } from './ItPhoneFormDialog';
import type { PhoneAccount, PhoneLineData } from '@/lib/it/phones';
import { ItPhoneQuickView, type PhoneItemOption } from './ItPhoneQuickView';
import { formatTicketDate } from './ticketStyles';

// Figma "IT / Phone Numbers" (966:39447): company phone lines, one card each — holder photo, name
// and role, the number with a copy button, then firm, plan, mail, office and since when, and the
// carrier and the device it runs on (company phone, personal phone, or none). Unassigned lines are
// "Available" and drawn in green. Active / History tabs, search, sort, user / assignment / firm
// filters. A card opens the line in a pop-up (ItPhoneQuickView) — no separate page; ?line=<id>
// opens it from a link (the old /it/phones/[id] address redirects here).
//
// Data: it_phone_lines (migrations 158, 161, 163) via lib/it/phones. "New Number" (edit.it) opens the form.

/** A line as the page loads it (no secrets — only whether each is saved). */
export type ItPhoneLine = PhoneLineData;

type Tab = 'active' | 'history';
type Sort = 'newest' | 'oldest' | 'name';
type Assignment = '' | 'assigned' | 'available';

const NO_EDIT = 'Adding numbers needs IT edit rights';
const CHIP = 'inline-flex items-center rounded-[4px] px-2 py-[3px] text-[13px] font-semibold leading-normal';
const CHIP_FILLED = cn(CHIP, SOLID_CHIP);
const CHIP_OUTLINE = cn(CHIP, 'border border-secondary-700 py-[2px] dark:border-secondary-50', STRONG);
const CHIP_FREE = cn(CHIP, 'bg-[var(--status-t9-fg)] text-[var(--status-t9-bg)]');

const ASSIGNMENT_OPTIONS = [
  { value: '', label: 'All lines' },
  { value: 'assigned', label: 'Assigned Only' },
  { value: 'available', label: 'Available Only' },
];

function DeviceChip({ line }: { line: ItPhoneLine }) {
  if (line.deviceName) return <span className={CHIP_FILLED}>{line.deviceName}</span>;
  if (line.personalDevice) return <span className={CHIP_OUTLINE}>Personal Phone</span>;
  return <span className={CHIP_FREE}>No Phone</span>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <dt className={cn('shrink-0 text-[12px] font-medium', MUTED)}>{label}</dt>
      <dd className={cn('m-0 min-w-0 truncate text-right text-[13px] font-semibold', STRONG)}>{children}</dd>
    </div>
  );
}

function PhoneCard({ line, onOpen }: { line: ItPhoneLine; onOpen: () => void }) {
  const free = !line.holderName;
  return (
    <article
      className={cn(
        'relative flex min-w-0 flex-col gap-3 rounded-[8px] bg-ui-surface p-4 transition-colors hover:bg-ui-hover-bg focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ui-focus-ring',
        free ? 'border-2 border-[var(--status-t9-fg)]' : 'border border-ui-divider',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div
          className={cn(
            'grid size-9 shrink-0 place-items-center overflow-hidden rounded-[4px] text-[13px] font-semibold',
            free ? 'bg-[var(--status-t9-fg)]' : 'bg-primary-100 text-secondary-700 dark:bg-primary-700 dark:text-secondary-50',
          )}
        >
          {!free && (
            <PersonFace
              name={line.holderName}
              userId={line.holderId}
              fallback={initials(line.holderName ?? '') || <UserRound size={18} aria-hidden />}
            />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className={cn('m-0 truncate text-[16px] font-semibold leading-5', free ? 'text-[var(--status-t9-fg)]' : STRONG)}>
            <button
              type="button"
              onClick={onOpen}
              aria-label={`${line.number}${free ? ', available' : `, ${line.holderName}`}. Open details`}
              className="max-w-full truncate bg-transparent p-0 text-left text-inherit outline-none after:absolute after:inset-0 after:rounded-[8px] after:content-['']"
            >
              {free ? 'Available' : line.holderName}
            </button>
          </h3>
          <p className="m-0 truncate text-[12px] font-medium leading-4 tracking-[0.36px] text-ui-body dark:text-primary-50">
            {free ? '-' : line.holderRole ? roleLabel(line.holderRole) : line.holderId ? '-' : 'No account yet'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-[4px] border border-[var(--ui-input-border)] bg-ui-input-bg py-1.5 pl-2 pr-[5px]">
        <Phone size={16} aria-hidden className={cn('shrink-0', STRONG)} />
        <span className={cn('min-w-0 flex-1 truncate text-[14px] font-semibold leading-[1.4] tracking-[0.84px]', STRONG)}>
          {line.number}
        </span>
        <button
          type="button"
          onClick={() => void copyText(line.number, 'Number')}
          aria-label={`Copy number ${line.number}`}
          title="Copy number"
          className={cn('relative z-10 grid size-[26px] shrink-0 place-items-center rounded-[4px] transition-opacity hover:opacity-90', SOLID_CHIP)}
        >
          <Copy size={14} aria-hidden />
        </button>
      </div>

      <dl className="m-0 flex flex-col gap-1.5 border-t border-dashed border-ui-divider pt-3">
        <Row label="Firm">{line.firm ?? '—'}</Row>
        <Row label="Plan">{line.monthlyCost != null ? `$${line.monthlyCost.toFixed(2)} / mo` : '—'}</Row>
        <Row label="Mail">{line.email ?? '—'}</Row>
        <Row label="Location">{line.location ?? '—'}</Row>
        <Row label={free ? 'Added' : 'Since'}>{formatTicketDate(free ? line.createdAt : line.holderSince ?? line.createdAt)}</Row>
      </dl>

      <div className="flex items-start justify-between gap-2">
        {line.carrier ? <span className={CHIP_FILLED}>{line.carrier}</span> : <span />}
        <DeviceChip line={line} />
      </div>
    </article>
  );
}

export function ItPhonesClient({ lines, error = null, canCreate = false, people = [], accounts = [], phoneItems = [] }: {
  lines: ItPhoneLine[];
  error?: string | null;
  canCreate?: boolean;
  /** Who can hold a line (edit.it only). */
  people?: { id: string; name: string }[];
  /** Carrier accounts in use, for the form's "Same account as". */
  accounts?: PhoneAccount[];
  /** Items Library phones for the form's "Phone from the Items Library" and the pop-up's photo. */
  phoneItems?: PhoneItemOption[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ItPhoneLine | null>(null);
  const open = openId ? lines.find(l => l.id === openId) ?? null : null;

  // ?line=<id> opens that line's pop-up (links from items, staff, the old detail address).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('line');
    if (id) setOpenId(id);
  }, []);
  function show(id: string | null) {
    setOpenId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('line', id); else url.searchParams.delete('line');
    window.history.replaceState(null, '', url);
  }
  const [tab, setTab] = useState<Tab>('active');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [holder, setHolder] = useState('');
  const [assignment, setAssignment] = useState<Assignment>('');
  const [firm, setFirm] = useState('');

  const activeCount = useMemo(() => lines.filter(l => l.active).length, [lines]);
  const holderOptions = useMemo(() => {
    const names = [...new Set(lines.map(l => l.holderName).filter((n): n is string => !!n))].sort((a, b) => a.localeCompare(b));
    return [{ value: '', label: 'All users' }, ...names.map(n => ({ value: n, label: n }))];
  }, [lines]);
  const firmOptions = useMemo(() => {
    const firms = [...new Set(lines.map(l => l.firm).filter((f): f is string => !!f))].sort((a, b) => a.localeCompare(b));
    return [{ value: '', label: 'All Firms' }, ...firms.map(f => ({ value: f, label: f }))];
  }, [lines]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lines
      .filter(l => l.active === (tab === 'active'))
      .filter(l => !holder || l.holderName === holder)
      .filter(l => !assignment || (assignment === 'assigned') === !!l.holderName)
      .filter(l => !firm || l.firm === firm)
      .filter(l => !q || `${l.holderName ?? ''} ${l.holderRole ?? ''} ${l.number} ${l.carrier ?? ''} ${l.firm ?? ''} ${l.deviceName ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === 'name') return (a.holderName ?? '￿').localeCompare(b.holderName ?? '￿');
        const diff = Date.parse(a.createdAt) - Date.parse(b.createdAt);
        return sort === 'newest' ? -diff : diff;
      });
  }, [lines, tab, holder, assignment, firm, query, sort]);

  return (
    <div className="flex w-full flex-col gap-[30px] p-7 font-ui">
      <PageHeading
        trail={[{ label: 'IT', href: '/it/tickets' }, { label: 'Phone Numbers', href: '/it/phones' }]}
        title="Phone Numbers"
        subtitle="Phone numbers management"
        bodyClassName="gap-2"
        titleAdornment={
          <span className="rounded-full bg-primary-50 px-[9px] py-[3px] text-[12px] font-semibold leading-[1.4] text-secondary-700 dark:bg-primary-700 dark:text-secondary-50">
            <span className="sr-only">Active numbers: </span>{activeCount}
          </span>
        }
        actions={
          <button
            type="button"
            disabled={!canCreate}
            onClick={() => setAdding(true)}
            title={canCreate ? undefined : NO_EDIT}
            className="flex h-9 items-center gap-2 rounded-md bg-accent-400 px-3 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-950"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            New Number
          </button>
        }
      />

      <div role="tablist" aria-label="Phone number views" className="flex h-12 items-stretch gap-8 border-b border-solid border-primary-100 dark:border-primary-600">
        <button role="tab" type="button" aria-selected={tab === 'active'} onClick={() => setTab('active')} className={tabClass(tab === 'active')}>
          Active Numbers
        </button>
        <button role="tab" type="button" aria-selected={tab === 'history'} onClick={() => setTab('history')} className={tabClass(tab === 'history')}>
          History
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative flex w-[380px] max-w-full items-center">
          <Search className={cn('pointer-events-none absolute left-3 h-4 w-4', MUTED)} strokeWidth={1.5} aria-hidden="true" />
          <span className="sr-only">Search phone numbers</span>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search numbers…"
            className={cn(FIELD, 'w-full pl-9 placeholder:text-primary-400 dark:placeholder:text-primary-200')}
          />
        </label>
        <div className="relative">
          <ArrowDownUp aria-hidden="true" className={TOOLBAR_SORT_ICON} />
          <Select
            aria-label="Sort phone numbers"
            className={cn(TOOLBAR_SELECT, 'pl-[34px] dark:pl-[34px]')}
            value={sort}
            onValueChange={v => setSort((v ?? 'newest') as Sort)}
            options={SORT_OPTIONS}
          />
        </div>
        <Select
          aria-label="Filter by user"
          className={cn(TOOLBAR_SELECT, 'pl-3 dark:pl-3')}
          value={holder}
          onValueChange={v => setHolder(v ?? '')}
          options={holderOptions}
        />
        <Select
          aria-label="Filter by assignment"
          className={cn(TOOLBAR_SELECT, 'pl-3 dark:pl-3')}
          value={assignment}
          onValueChange={v => setAssignment((v ?? '') as Assignment)}
          options={ASSIGNMENT_OPTIONS}
        />
        <Select
          aria-label="Filter by firm"
          className={cn(TOOLBAR_SELECT, 'pl-3 dark:pl-3')}
          value={firm}
          onValueChange={v => setFirm(v ?? '')}
          options={firmOptions}
        />
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-[var(--status-t10-fg)] bg-[var(--status-t10-bg)] px-4 py-3 text-[13px] text-[var(--status-t10-fg)]">
          {error}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-[11px] border border-dashed border-primary-300 px-6 py-14 text-center dark:border-primary-600">
          <p className="m-0 text-[15px] font-semibold text-secondary-700 dark:text-primary-50">
            {tab === 'active' ? 'No active phone numbers' : 'No retired phone numbers'}
          </p>
          <p className="m-0 text-[13px] text-ui-body">
            {lines.length === 0 ? 'Company phone numbers will show up here.' : 'Nothing matches these filters.'}
          </p>
        </div>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-4">
          {visible.map(l => (
            <li key={l.id} className="min-w-0">
              <PhoneCard line={l} onOpen={() => show(l.id)} />
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <ItPhoneFormDialog initial={EMPTY_PHONE} people={people} accounts={accounts} phoneItems={phoneItems} onClose={() => setAdding(false)}
          onSaved={id => { setAdding(false); router.refresh(); show(id); }} />
      )}
      {open && (
        <ItPhoneQuickView
          line={open}
          item={open.itemId ? phoneItems.find(i => i.id === open.itemId) ?? null : null}
          canEdit={canCreate}
          people={people} phoneItems={phoneItems} accounts={accounts.filter(a => a.lineId !== open.id)}
          onClose={() => show(null)}
          onSaved={() => router.refresh()}
          onDelete={() => setDeleting(open)}
        />
      )}
      <ConfirmModal
        open={!!deleting} onOpenChange={o => { if (!o) setDeleting(null); }} tone="destructive" confirmLabel="Delete number"
        title={`Delete ${deleting?.number ?? 'this number'}?`}
        warning="The line and its saved account details are removed from the IT list. To keep it on record, mark it Retired in Edit Info instead."
        onConfirm={async () => {
          if (!deleting) return;
          const res = await fetch(`/api/it/phones/${deleting.id}`, { method: 'DELETE' });
          if (!res.ok) { toast.error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Could not delete'); throw new Error('kept'); }
          toast.success('Number deleted');
          setDeleting(null);
          show(null);
          router.refresh();
        }}
      />
    </div>
  );
}
