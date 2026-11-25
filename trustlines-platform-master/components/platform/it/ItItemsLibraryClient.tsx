'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowDownUp, Copy, Ellipsis, ExternalLink, Link2, MapPin, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react';
import { Menu, MenuContent, MenuItem, MenuLinkItem, MenuTrigger } from '@/components/ui/menu';
import { ConfirmModal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { PageHeading } from '@/components/platform/shared/PageHeading';
import { MonitorPcIcon } from './MonitorPcIcon';
import { TOOLBAR_SELECT, TOOLBAR_SORT_ICON } from './ticketStyles';
import { MAX_DUPLICATES } from '@/lib/it/duplicateItem';
import { byCustomOrder, moveId, positionChanges } from '@/lib/it/itemOrder';
import { EMPTY_ITEM, ItItemFormDialog } from './ItItemFormDialog';
import { LabelSheetDialog } from './LabelSheetDialog';
import { CATEGORY_LABEL, MUTED, OUTLINE_CHIP, SOLID_CHIP, STRONG, formatItemDate, type ItItem, type ItItemCategory } from './itemStyles';

export type { ItItem, ItItemCategory, ItItemStatus } from './itemStyles';

// Figma "Items Library" (843:41158): IT equipment — search, sort and "Add Item", category tabs with
// counts, then a grid of item cards. A card's border and pill follow the item's status: Available
// (green border + solid green pill), Repair (red pill) or assigned (outlined pill with the person).

type Tab = 'all' | ItItemCategory;
type Sort = 'custom' | 'newest' | 'oldest';

const SORT_OPTIONS = [
  { value: 'custom', label: 'My order' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
];

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

const FIELD =
  'h-9 rounded-md border border-primary-200 bg-white px-3 text-[13px] font-ui text-secondary-700 outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring dark:border-secondary-500 dark:bg-primary-800 dark:text-secondary-50';

function StatusPill({ item }: { item: ItItem }) {
  const base = 'flex h-7 shrink-0 items-center justify-center rounded-md px-6 text-[13px] font-semibold whitespace-nowrap';
  if (item.status === 'available') {
    return <span className={base} style={{ background: 'var(--status-t9-fg)', color: 'var(--status-t9-bg)' }}>Available</span>;
  }
  if (item.status === 'repair') {
    return <span className={base} style={{ background: 'var(--status-t10-fg)', color: 'var(--status-t10-bg)' }}>Repair</span>;
  }
  return (
    <span className={cn(base, 'max-w-[160px] px-4', OUTLINE_CHIP)}>
      <span className="truncate">{item.assigneeName ?? 'Assigned'}</span>
    </span>
  );
}

/** One item card (also used on IT → Staff member). Duplicate / Delete show only when their handler is given. */
export function ItemCard({ item, canEdit, onDelete, onDuplicate }: { item: ItItem; canEdit: boolean; onDelete?: (item: ItItem) => void; onDuplicate?: (item: ItItem) => void }) {
  const available = item.status === 'available';
  return (
    <article
      aria-label={item.name}
      className={cn(
        'relative flex flex-col overflow-hidden rounded-lg border-solid bg-white transition-shadow focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ui-focus-ring hover:shadow-04 dark:bg-primary-950',
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
            {/* Stretched link: the whole card opens the item; the menu button sits above it. */}
            <Link
              href={`/it/items/${encodeURIComponent(item.id)}`}
              className={cn('truncate text-[20px] font-semibold no-underline outline-none after:absolute after:inset-0 after:content-[""]', STRONG)}
            >
              {item.name}
            </Link>
            <p className={cn('m-0 truncate text-[16px] tracking-[0.48px]', MUTED)}>
              {[item.model, formatItemDate(item.addedAt)].filter(Boolean).join(' · ')}
            </p>
          </div>
          <Menu>
            <MenuTrigger
              render={<button type="button" aria-label={`More actions for ${item.name}`} className={cn('relative z-10 grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded border-0 bg-transparent p-0 hover:opacity-80', STRONG)} />}
            >
              <Ellipsis className="h-[23px] w-[23px]" strokeWidth={2} aria-hidden="true" />
            </MenuTrigger>
            <MenuContent>
              <MenuLinkItem render={<Link href={`/it/items/${encodeURIComponent(item.id)}`} />}>
                <ExternalLink aria-hidden /> Open
              </MenuLinkItem>
              {canEdit && <>
                <MenuLinkItem render={<Link href={`/it/items/${encodeURIComponent(item.id)}?edit=1`} />}>
                  <Pencil aria-hidden /> Edit Info
                </MenuLinkItem>
                {onDuplicate && (
                  <MenuItem onClick={() => onDuplicate(item)}>
                    <Copy aria-hidden /> Duplicate
                  </MenuItem>
                )}
                {onDelete && (
                  <MenuItem onClick={() => onDelete(item)}>
                    <Trash2 aria-hidden /> Delete
                  </MenuItem>
                )}
              </>}
            </MenuContent>
          </Menu>
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

export function ItItemsLibraryClient({ items, error = null, canCreate = false, assignees = [] }: {
  items: ItItem[];
  error?: string | null;
  /** edit.it: Add Item, Edit Info and Delete. */
  canCreate?: boolean;
  assignees?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [deleting, setDeleting] = useState<ItItem | null>(null);
  const [duplicating, setDuplicating] = useState<ItItem | null>(null);
  const [copies, setCopies] = useState('1');

  async function duplicate(item: ItItem) {
    const count = Number(copies);
    if (!Number.isInteger(count) || count < 1 || count > MAX_DUPLICATES) {
      toast.error(`Choose between 1 and ${MAX_DUPLICATES} copies`);
      throw new Error('bad count');
    }
    const res = await fetch(`/api/it/items/${item.id}/duplicate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null) as { error?: string } | null;
      toast.error(j?.error ?? 'Could not duplicate the item');
      throw new Error('duplicate failed');
    }
    toast.success(count === 1 ? `${item.name} duplicated` : `${count} copies of ${item.name} added`);
    router.refresh();
  }

  async function remove(item: ItItem) {
    const res = await fetch(`/api/it/items/${item.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const j = await res.json().catch(() => null) as { error?: string } | null;
      toast.error(j?.error ?? 'Could not delete the item');
      throw new Error('delete failed');
    }
    toast.success(`${item.name} deleted`);
    router.refresh();
  }
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('custom');
  // "My order": drag a card onto another to take its place. Local places show at once, then save.
  const [places, setPlaces] = useState<Map<string, number> | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const ordered = useMemo(
    () => items.map(i => ({ ...i, addedAt: i.addedAt, position: places?.get(i.id) ?? i.position ?? null })).sort(byCustomOrder),
    [items, places],
  );
  const canDrag = canCreate && sort === 'custom' && !query.trim();

  async function dropOn(targetId: string) {
    const id = dragId;
    setDragId(null); setOverId(null);
    if (!id || id === targetId) return;
    const ids = moveId(ordered.map(i => i.id), id, targetId);
    const changes = positionChanges(ordered, ids);
    if (!changes.length) return;
    const before = places;
    setPlaces(new Map(ids.map((x, n) => [x, n])));
    const res = await fetch('/api/it/items/order', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: changes }),
    }).catch(() => null);
    if (!res?.ok) {
      const j = await res?.json().catch(() => null) as { error?: string } | null;
      toast.error(j?.error ?? 'Could not save the order');
      setPlaces(before);
      return;
    }
    router.refresh();
  }

  const counts = useMemo(() => {
    const byTab = new Map<Tab, number>([['all', items.length]]);
    for (const i of items) byTab.set(i.category, (byTab.get(i.category) ?? 0) + 1);
    return byTab;
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (sort === 'custom' ? ordered : items)
      .filter(i => tab === 'all' || i.category === tab)
      .filter(i => !q || [i.name, i.model, i.setLabel, i.location, i.assigneeName].some(v => v?.toLowerCase().includes(q)))
      .sort((a, b) => {
        if (sort === 'custom') return 0;
        const diff = new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
        return sort === 'newest' ? -diff : diff;
      });
  }, [items, ordered, tab, query, sort]);

  return (
    <div className="flex w-full flex-col gap-6 p-7 font-ui">
      <PageHeading trail={[{ label: 'IT', href: '/it/tickets' }, { label: 'Items Library', href: '/it/items' }]} title="Items Library" subtitle="PCs, Monitors, TVs, etc." />

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
          <div className="relative">
            <ArrowDownUp aria-hidden="true" className={TOOLBAR_SORT_ICON} />
            <Select
              aria-label="Sort items"
              className={cn(TOOLBAR_SELECT, 'h-9 pl-[34px] dark:pl-[34px]')}
              value={sort}
              onValueChange={v => setSort((v ?? 'custom') as Sort)}
              options={SORT_OPTIONS}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={visible.length === 0}
          onClick={() => setPrinting(true)}
          className={cn('flex h-10 items-center gap-2 rounded-md pl-5 pr-6 text-[13px] font-semibold transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50', OUTLINE_CHIP)}
        >
          <Printer className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Print labels
        </button>
        <button
          type="button"
          disabled={!canCreate}
          onClick={() => setAdding(true)}
          title={canCreate ? undefined : 'Your role cannot add IT items'}
          className="flex h-10 items-center gap-3 rounded-md bg-accent-400 pl-[30px] pr-[41px] text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-950"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Add Item
        </button>
        </div>
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
            <li
              key={i.id}
              draggable={canDrag}
              onDragStart={e => { setDragId(i.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setDragImage(e.currentTarget, 40, 40); }}
              onDragOver={e => { if (dragId) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overId !== i.id) setOverId(i.id); } }}
              onDragLeave={() => { if (overId === i.id) setOverId(null); }}
              onDrop={e => { e.preventDefault(); void dropOn(i.id); }}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
              className={cn(
                'rounded-lg transition-opacity',
                canDrag && 'cursor-grab active:cursor-grabbing',
                dragId === i.id && 'opacity-40',
                overId === i.id && dragId !== i.id && 'outline-2 outline-offset-4 outline-dashed outline-ui-focus-ring',
              )}
            >
              <ItemCard item={i} canEdit={canCreate} onDelete={setDeleting} onDuplicate={it => { setCopies('1'); setDuplicating(it); }} />
            </li>
          ))}
        </ul>
      )}

      {printing && (
        <LabelSheetDialog
          selectable
          items={visible.map(i => ({ id: i.id, name: i.name, detail: [CATEGORY_LABEL[i.category], i.setLabel, i.location].filter(Boolean).join(' · ') }))}
          onClose={() => setPrinting(false)}
        />
      )}
      {adding && (
        <ItItemFormDialog
          initial={EMPTY_ITEM}
          assignees={assignees}
          onClose={() => setAdding(false)}
          onSaved={id => { setAdding(false); router.push(`/it/items/${id}`); }}
          onCreated={() => router.refresh()}
        />
      )}
      <ConfirmModal
        open={!!duplicating}
        onOpenChange={o => { if (!o) setDuplicating(null); }}
        title="Duplicate item?"
        description={duplicating ? `Copies of ${duplicating.name} with the same photo, type, office, notes and specs. Each copy starts available — no one holds it.` : undefined}
        confirmLabel="Duplicate"
        onConfirm={async () => { if (duplicating) await duplicate(duplicating); setDuplicating(null); }}
      >
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ui-body">
          How many copies?
          <input
            type="number" min={1} max={MAX_DUPLICATES} step={1} value={copies} onChange={e => setCopies(e.target.value)}
            className="h-10 w-28 rounded-md border border-[var(--ui-input-border)] bg-ui-input-bg px-3 text-[14px] text-secondary-700 outline-none focus-visible:outline-2 focus-visible:outline-ui-focus-ring dark:text-secondary-50"
          />
        </label>
      </ConfirmModal>
      <ConfirmModal
        open={!!deleting}
        onOpenChange={o => { if (!o) setDeleting(null); }}
        title="Delete item?"
        description={deleting ? `${deleting.name} is removed from the Items Library.` : undefined}
        confirmLabel="Delete"
        tone="destructive"
        onConfirm={async () => { if (deleting) await remove(deleting); setDeleting(null); }}
      />
    </div>
  );
}
