'use client';

import { CalendarDays, ListFilter, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select } from '@/components/platform/shared/Select';
import { CONTROL_STYLE, RANGES, typeLabel } from './notificationFormat';
import type { NotificationTab } from './notificationTypes';

export function NotificationsToolbar({
  tab, onTabChange, allCount, unreadCount,
  query, onQueryChange, types, typeFilter, onTypeFilterChange, rangeDays, onRangeDaysChange,
}: {
  tab: NotificationTab;
  onTabChange: (tab: NotificationTab) => void;
  allCount: number;
  unreadCount: number;
  query: string;
  onQueryChange: (q: string) => void;
  types: string[];
  typeFilter: string;
  onTypeFilterChange: (type: string) => void;
  rangeDays: number;
  onRangeDaysChange: (days: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <div role="tablist" aria-label="Notification views" className="flex gap-2">
        {([['all', 'All', allCount], ['unread', 'Unread', unreadCount]] as const).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => onTabChange(key)}
            className={cn(
              'inline-flex h-9 cursor-pointer items-center gap-2 rounded-[6px] border-0 px-3 text-[13px] text-[var(--color-secondary-700)] dark:text-ui-heading',
              tab === key ? 'bg-ui-selected-bg font-semibold' : 'bg-transparent hover:bg-ui-hover-bg',
            )}
          >
            {label}
            <span className="text-[11px] font-normal text-ui-text-secondary">{count}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-[280px] max-w-full">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" aria-hidden />
          <input
            className="form-input"
            style={{ ...CONTROL_STYLE, paddingLeft: 30 }}
            placeholder="Search notifications…"
            aria-label="Search notifications"
            value={query}
            onChange={e => onQueryChange(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <ListFilter size={14} className="text-ui-text-secondary" aria-hidden />
          <Select className="form-input" style={{ ...CONTROL_STYLE, minWidth: 130 }} value={typeFilter} onChange={e => onTypeFilterChange(e.target.value)} aria-label="Filter by type">
            <option value="">All types</option>
            {types.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <CalendarDays size={14} className="text-ui-text-secondary" aria-hidden />
          <Select className="form-input" style={{ ...CONTROL_STYLE, minWidth: 130 }} value={String(rangeDays)} onChange={e => onRangeDaysChange(Number(e.target.value))} aria-label="Date range">
            {RANGES.map(r => <option key={r.days} value={r.days}>{r.label}</option>)}
          </Select>
        </div>
      </div>
    </div>
  );
}
