'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SortState } from '@/lib/ui/sort';

// A table header you click to sort by that column: first click = the column's natural direction
// (newest first for dates), again = the other way. Put `aria-sort={ariaSort(sort, key)}` on the <th>.

export function SortHeader<K extends string>({ label, sortKey, sort, onSort, firstDir = 'desc', className }: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (next: SortState<K>) => void;
  /** Direction of the first click on this column (dates: newest first). */
  firstDir?: 'asc' | 'desc';
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(active ? { key: sortKey, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key: sortKey, dir: firstDir })}
      className={cn('inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-[inherit] text-[inherit] hover:text-secondary-700 dark:hover:text-secondary-50', active && 'text-secondary-700 dark:text-secondary-50', className)}
      title={`Sort by ${label.toLowerCase()}`}
    >
      {label}
      <Icon className={cn('h-3 w-3 shrink-0', !active && 'opacity-40')} aria-hidden="true" />
    </button>
  );
}
