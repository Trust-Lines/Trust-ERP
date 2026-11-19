'use client';

import Link from 'next/link';
import { ArrowDownUp, ChevronDown, Columns2, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { LEAD_COLUMNS } from '../LeadsTable';
import { FILTER_CLS, SORT_OPTIONS, VIEW_TABS, type ViewMode } from './boardConfig';

/** Right side of the toolbar: sort, Columns (list view only), Trash link, view switch. */
export function BoardViewControls({ sortBy, onSortChange, view, onViewChange, hiddenCols, onToggleCol }: {
  sortBy: string;
  onSortChange: (v: string) => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  hiddenCols: Set<string>;
  onToggleCol: (name: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-4">
      <div className="flex items-center gap-2">
        <div className="relative">
          <ArrowDownUp aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-[var(--color-secondary-700)] dark:text-ui-heading" />
          <Select
            aria-label="Sort"
            className={cn(FILTER_CLS, 'gap-2 pl-[34px] dark:pl-[34px] dark:pr-2')}
            value={sortBy}
            onValueChange={v => onSortChange(v ?? 'created_desc')}
            options={SORT_OPTIONS}
          />
        </div>

        {view === 'list' && (
          // Checkbox list that stays open while ticking: shared Popover; backdrop keeps the old
          // behaviour (a click outside only closes it).
          <Popover>
            <PopoverTrigger className={cn(FILTER_CLS, 'gap-2 px-3')} onClick={e => e.stopPropagation()}>
              <Columns2 aria-hidden />
              Columns
              <ChevronDown aria-hidden />
            </PopoverTrigger>
            <PopoverContent backdrop aria-label="Columns" sideOffset={6} className="w-52 max-h-80 gap-0 overflow-auto rounded-xl p-1.5 shadow-lg">
              {LEAD_COLUMNS.map((c, i) => (
                <label key={c} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${i === 0 ? 'text-primary-400 dark:text-primary-300' : 'text-primary-700 dark:text-primary-100 hover:bg-primary-50 dark:hover:bg-primary-700 cursor-pointer'}`}>
                  <Checkbox disabled={i === 0} checked={i === 0 || !hiddenCols.has(c)} onCheckedChange={() => onToggleCol(c)} />
                  {c}
                </label>
              ))}
            </PopoverContent>
          </Popover>
        )}

        <Link href="/leads/trash" aria-label="Trash" title="Trash" className={cn(FILTER_CLS, 'px-2.5 no-underline')}>
          <Trash2 aria-hidden />
        </Link>
      </div>

      <span aria-hidden className="h-9 w-px bg-ui-divider" />

      <div role="group" aria-label="View" className="flex items-center gap-2">
        {VIEW_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            onClick={() => onViewChange(key)}
            className={cn(
              'inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border px-8 text-[13px] font-semibold leading-[1.4] transition-colors [&_svg]:size-3.5',
              view === key
                ? 'border-[var(--color-secondary-700)] bg-transparent text-[var(--color-secondary-700)] dark:border-ui-heading dark:text-ui-heading'
                : 'border-ui-divider bg-ui-surface-elevated text-ui-body hover:bg-ui-hover-bg',
            )}
          >
            <Icon aria-hidden />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
