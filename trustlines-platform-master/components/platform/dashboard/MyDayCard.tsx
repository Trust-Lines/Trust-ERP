'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown, ArrowUp, ArrowUpRight, CalendarDays, ChevronsUp, ChevronsDown, ChevronsUpDown, CircleAlert, CircleCheck,
  ClipboardList, Clock, Equal, Ellipsis,
} from 'lucide-react';
import type { MyDayData, MyDayItem } from '@/lib/dashboard/myDay';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

// Same /api/my-day feed as components/platform/dashboard/MyDay.tsx (signatures waiting on me,
// QC queue, overdue follow-ups, etc. — computed per-role in lib/dashboard/myDay.ts), shown as the
// "My Tasks" table from Figma "ops_manager" (node 376:31556). Priority comes from the item's tone.
type Row = MyDayItem & { section: string };
type SortKey = 'label' | 'section' | 'priority';

const PRIORITY: Record<NonNullable<MyDayItem['tone']>, { rank: number; label: string; icon: typeof Equal; color: string }> = {
  danger:  { rank: 3, label: 'High',   icon: ChevronsUp,   color: 'var(--color-error-normal)' },
  warn:    { rank: 2, label: 'Medium', icon: Equal,        color: 'var(--ui-body)' },
  default: { rank: 1, label: 'Medium', icon: Equal,        color: 'var(--ui-body)' },
  good:    { rank: 0, label: 'Low',    icon: ChevronsDown, color: 'var(--ui-body)' },
};

// Status chip per Figma's Status Chip rules: colour is never the only signal, so each tone has an icon.
const CHIP: Record<NonNullable<MyDayItem['tone']>, { tone: string; icon: typeof Clock }> = {
  danger:  { tone: 't10', icon: CircleAlert },
  warn:    { tone: 't7',  icon: Clock },
  default: { tone: 't1',  icon: CalendarDays },
  good:    { tone: 't9',  icon: CircleCheck },
};

const COLLAPSED_ROWS = 6;
const GRID = 'grid grid-cols-[48px_minmax(0,279fr)_minmax(0,214fr)_minmax(0,180fr)_minmax(0,181fr)_108px] items-center';
const TH = 'inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-[13px] font-semibold leading-[1.4] text-ui-body';
const TH_ACTIVE = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const CHECKBOX = 'size-4 rounded-[3px] border-[var(--ui-input-border)] bg-ui-input-bg dark:border-[#4D6E98] dark:bg-ui-input-bg';

export function MyDayCard({ className, full = false }: { className?: string; full?: boolean }) {
  const [data, setData] = useState<MyDayData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const [asc, setAsc] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/my-day')
      .then(res => { if (!res.ok) throw new Error(String(res.status)); return res.json(); })
      .then((json: MyDayData) => { if (live) { setData(json); setError(false); } })
      .catch(() => { if (live) setError(true); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const items = useMemo(() => {
    const rows: Row[] = (data?.sections ?? []).flatMap(s => s.items.map(i => ({ ...i, section: s.title })));
    const rank = (r: Row) => PRIORITY[r.tone ?? 'default'].rank;
    return rows.sort((a, b) => {
      const d = sortKey === 'priority' ? rank(a) - rank(b) : a[sortKey].localeCompare(b[sortKey]);
      return asc ? d : -d;
    });
  }, [data, sortKey, asc]);
  const shown = full ? items : items.slice(0, COLLAPSED_ROWS);

  function sortBy(key: SortKey) {
    if (key === sortKey) setAsc(v => !v);
    else { setSortKey(key); setAsc(key !== 'priority'); }
  }
  function sortIcon(key: SortKey) {
    if (key !== sortKey) return <ChevronsUpDown size={12} aria-hidden />;
    return asc ? <ArrowUp size={13} aria-hidden /> : <ArrowDown size={13} aria-hidden />;
  }
  function toggle(i: number) {
    setSelected(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; });
  }
  const allSelected = shown.length > 0 && shown.every((_, i) => selected.has(i));

  return (
    <div className={cn('flex min-w-0 flex-col overflow-hidden rounded-[10px] border border-ui-divider bg-ui-page-bg', className)}>
      <div className={cn(GRID, 'h-[50px] border-b border-ui-divider bg-ui-surface pr-2.5')}>
        <span className="flex justify-center">
          <Checkbox
            aria-label="Select all tasks" className={CHECKBOX} checked={allSelected}
            onCheckedChange={() => setSelected(allSelected ? new Set() : new Set(shown.map((_, i) => i)))}
          />
        </span>
        <button type="button" className={cn(TH, sortKey === 'label' && TH_ACTIVE)} onClick={() => sortBy('label')}>Tasks {sortIcon('label')}</button>
        <button type="button" className={cn(TH, sortKey === 'section' && TH_ACTIVE)} onClick={() => sortBy('section')}>Status {sortIcon('section')}</button>
        <button type="button" className={cn(TH, sortKey === 'priority' && TH_ACTIVE)} onClick={() => sortBy('priority')}>Priority {sortIcon('priority')}</button>
        <span className={TH}>Details</span>
        {full ? <span /> : (
          <Link
            href="/my-tasks"
            className="inline-flex h-7 items-center justify-center gap-2 justify-self-end whitespace-nowrap rounded-[6px] bg-[var(--color-secondary-700)] px-3 text-[13px] font-medium leading-[1.35] text-white no-underline dark:bg-[#EEF2F6] dark:text-[#0A0C0F]"
          >
            View All <ArrowUpRight size={16} aria-hidden />
          </Link>
        )}
      </div>

      {loading ? (
        <p role="status" className="m-auto p-6 text-[13px] text-ui-body">Loading your day…</p>
      ) : error ? (
        <p role="alert" className="m-auto p-6 text-[13px] text-ui-body">Couldn&apos;t load your day. Refresh to try again.</p>
      ) : items.length === 0 ? (
        <EmptyState size="sm" className="m-auto justify-center p-6" icon={<ClipboardList />} title="Nothing needs you right now." />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {shown.map((item, i) => {
            const p = PRIORITY[item.tone ?? 'default'];
            const Icon = p.icon;
            const chip = CHIP[item.tone ?? 'default'];
            const ChipIcon = chip.icon;
            return (
              <div key={`${item.href}-${i}`} className={cn(GRID, 'h-9 border-b border-ui-divider bg-ui-surface-elevated pr-2.5 last:border-b-0')}>
                <span className="flex justify-center">
                  <Checkbox aria-label={`Select ${item.label}`} className={CHECKBOX} checked={selected.has(i)} onCheckedChange={() => toggle(i)} />
                </span>
                <Link href={item.href} className="truncate text-[13px] leading-[1.4] text-ui-body no-underline hover:underline">{item.label}</Link>
                <span>
                  <span className="inline-flex max-w-full items-center gap-1 rounded-[4px] py-[3px] pl-2 pr-2.5 text-[12px] font-medium leading-4" style={{ background: `var(--status-${chip.tone}-bg)`, color: `var(--status-${chip.tone}-fg)` }}>
                    <ChipIcon size={14} aria-hidden className="shrink-0" />
                    <span className="truncate">{item.badge ?? item.section}</span>
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: p.color }}>
                  <Icon size={13} aria-hidden /> {p.label}
                </span>
                <span className="truncate text-[13px] leading-[1.4] text-ui-text-secondary">{item.sublabel ?? item.section}</span>
                <Link href={item.href} aria-label={`Open ${item.label}`} className="flex justify-center text-ui-body">
                  <Ellipsis size={16} aria-hidden />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
