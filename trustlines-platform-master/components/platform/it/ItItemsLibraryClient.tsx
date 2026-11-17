'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { ChevronDown, Ellipsis, Link2, ListFilter, MapPin, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeading } from '@/components/platform/shared/PageHeading';
import { MonitorPcIcon } from './MonitorPcIcon';
import { NOT_CONNECTED_TITLE } from './ticketStyles';

// Figma "Items Library" (843:41158): IT equipment — search, sort and "Add Item", category tabs with
// counts, then a grid of item cards. A card's border and pill follow the item's status: Available
// (green border + solid green pill), Repair (red pill) or assigned (outlined pill with the person).

export type ItItemCategory = 'full_set' | 'pc' | 'monitor' | 'tv' | 'keyboard_set' | 'phone' | 'laptop' | 'printer';
export type ItItemStatus = 'available' | 'repair' | 'assigned';

export interface ItItem {
  id: string;
  name: string;
  /** Short spec line shown before the date ("High Performance"). */
  model: string | null;
  category: ItItemCategory;
  /** ISO date the item was added ("7/9/2026"). */
  addedAt: string;
  /** Set the item belongs to ("PC 1"), if any. */
  setLabel: string | null;
  location: string | null;
  status: ItItemStatus;
  /** Person holding the item when `status` is `assigned`. */
  assigneeName: string | null;
  imageUrl: string | null;
}

type Tab = 'all' | ItItemCategory;
type Sort = 'newest' | 'oldest';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'full_set', label: 'Full Sets' },
  { key: 'pc', label: 'PCs' },
  { key: 'monitor', label: 'Monitors' },
  { key: 'tv', label: 'TVs' },
  { key: 'keyboard_set', label: 'Keyboard Sets' },
  { key: 'phone', label: 'Phones' },
  { key: 'laptop', label: 'Laptops' },
  { key: 'printer', label: 'Printers' },
];

// Light / dark: strong text secondary-700 / secondary-50, muted primary-400 / primary-200, and the
// navy "primary-button" chips flip to near-white with dark text.
const STRONG = 'text-secondary-700 dark:text-secondary-50';
const MUTED = 'text-primary-400 dark:text-primary-200';
const SOLID_CHIP = 'bg-secondary-700 text-white dark:bg-secondary-50 dark:text-primary-950';
const FIELD =
  'h-9 rounded-md border border-primary-200 bg-white px-3 text-[13px] font-ui text-secondary-700 outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring dark:border-secondary-500 dark:bg-primary-800 dark:text-secondary-50';

function formatAdded(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US');
}

function StatusPill({ item }: { item: ItItem }) {
  const base = 'flex h-7 shrink-0 items-center justify-center rounded-md px-6 text-[13px] font-semibold whitespace-nowrap';
  if (item.status === 'available') {
    return <span className={base} style={{ background: 'var(--status-t9-fg)', color: 'var(--status-t9-bg)' }}>Available</span>;
  }
  if (item.status === 'repair') {
    return <span className={base} style={{ background: 'var(--status-t10-fg)', color: 'var(--status-t10-bg)' }}>Repair</span>;
  }
  return (
    <span className={cn(base, 'max-w-[160px] border border-solid border-secondary-700 px-4 dark:border-secondary-50', STRONG)}>
      <span className="truncate">{item.assigneeName ?? 'Assigned'}</span>
    </span>
  );
}

function ItemCard({ item }: { item: ItItem }) {
  const available = item.status === 'available';
  return (
    <article
      aria-label={item.name}
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border-solid bg-white dark:bg-primary-950',
        available ? 'border-2 border-[var(--status-t9-fg)]' : 'border border-primary-100 dark:border-primary-600',
      )}
    >
      <div className="relative flex h-[229px] items-center justify-center border-b border-solid border-primary-100 bg-white text-primary-300 dark:border-primary-600 dark:bg-primary-950">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt="" fill unoptimized sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw" className="object-contain p-3" />
        ) : (
          <MonitorPcIcon className="h-12 w-12" strokeWidth={1.25} />
        )}
      </div>
      <div className="flex flex-col gap-4 bg-primary-50 p-4 dark:bg-primary-700">
        <div className="flex items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col leading-normal">
            <p className={cn('m-0 truncate text-[20px] font-semibold', STRONG)}>{item.name}</p>
            <p className={cn('m-0 truncate text-[16px] tracking-[0.48px]', MUTED)}>
              {[item.model, formatAdded(item.addedAt)].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button
            type="button"
            disabled
            aria-label={`More actions for ${item.name}`}
            title={NOT_CONNECTED_TITLE}
            className={cn('grid h-6 w-6 shrink-0 place-items-center rounded disabled:cursor-not-allowed', STRONG)}
          >
            <Ellipsis className="h-[23px] w-[23px]" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {item.setLabel && (
              <span className={cn('flex h-7 items-center gap-1 rounded-md pl-[13px] pr-2 text-[13px] font-semibold whitespace-nowrap', SOLID_CHIP)}>
                {item.setLabel}
                <Link2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              </span>
            )}
            {item.location && (
              <span className={cn('flex h-7 items-center gap-1 rounded-md pl-2 pr-[13px] text-[13px] font-semibold whitespace-nowrap', SOLID_CHIP)}>
                <MapPin className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                {item.location}
              </span>
            )}
          </div>
          <StatusPill item={item} />
        </div>
      </div>
    </article>
  );
}

export function ItItemsLibraryClient({ items, error = null, canCreate = false }: {
  items: ItItem[];
  error?: string | null;
  canCreate?: boolean;
}) {
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('newest');

  const counts = useMemo(() => {
    const byTab = new Map<Tab, number>([['all', items.length]]);
    for (const i of items) byTab.set(i.category, (byTab.get(i.category) ?? 0) + 1);
    return byTab;
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter(i => tab === 'all' || i.category === tab)
      .filter(i => !q || [i.name, i.model, i.setLabel, i.location, i.assigneeName].some(v => v?.toLowerCase().includes(q)))
      .sort((a, b) => {
        const diff = new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
        return sort === 'newest' ? -diff : diff;
      });
  }, [items, tab, query, sort]);

  return (
    <div className="flex w-full flex-col gap-6 p-7 font-ui">
      <PageHeading trail="IT / Items Library" title="Items Library" subtitle="PCs, Monitors, TVs, etc." />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="relative flex w-[285px] max-w-full items-center">
            <Search className={cn('pointer-events-none absolute left-3 h-4 w-4', MUTED)} strokeWidth={1.5} aria-hidden="true" />
            <span className="sr-only">Search items</span>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search items…"
              className={cn(FIELD, 'w-full pl-9 placeholder:text-primary-400 dark:placeholder:text-primary-200')}
            />
          </label>
          <label className="relative flex items-center">
            <ListFilter className={cn('pointer-events-none absolute left-3 h-3.5 w-3.5', STRONG)} strokeWidth={1.5} aria-hidden="true" />
            <span className="sr-only">Sort items</span>
            <select value={sort} onChange={e => setSort(e.target.value as Sort)} className={cn(FIELD, 'appearance-none pl-8 pr-8 font-medium')}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
            <ChevronDown className={cn('pointer-events-none absolute right-3 h-3.5 w-3.5', STRONG)} strokeWidth={1.5} aria-hidden="true" />
          </label>
        </div>
        <button
          type="button"
          disabled={!canCreate}
          title={canCreate ? undefined : NOT_CONNECTED_TITLE}
          className="flex h-10 items-center gap-3 rounded-md bg-accent-400 pl-[30px] pr-[41px] text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-950"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Add Item
        </button>
      </div>

      <div role="tablist" aria-label="Item categories" className="flex gap-2 overflow-x-auto border-b border-solid border-primary-100 pb-3 scrollbar-none dark:border-primary-600">
        {TABS.map(t => {
          const on = t.key === tab;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex h-[38px] shrink-0 items-center gap-2 rounded-md px-4 text-[13px] whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring',
                STRONG,
                on ? 'bg-secondary-100 font-semibold dark:bg-secondary-700' : 'font-medium hover:bg-primary-50 dark:hover:bg-primary-800',
              )}
            >
              {t.label}
              <span className={cn('text-[12px] font-normal leading-[1.4]', MUTED)}>{counts.get(t.key) ?? 0}</span>
            </button>
          );
        })}
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-[var(--status-t10-fg)] bg-[var(--status-t10-bg)] px-4 py-3 text-[13px] text-[var(--status-t10-fg)]">
          {error}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-[11px] border border-dashed border-primary-300 px-6 py-14 text-center dark:border-primary-600">
          <p className={cn('m-0 text-[15px] font-semibold', STRONG)}>No items</p>
          <p className="m-0 text-[13px] text-ui-body">
            {items.length === 0 ? 'IT equipment added to the library will show up here.' : 'Nothing matches this search.'}
          </p>
        </div>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map(i => (
            <li key={i.id}>
              <ItemCard item={i} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
