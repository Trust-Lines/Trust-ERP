'use client';

import { Bell, CircleCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HEADING_TEXT, groupLabel } from './notificationFormat';
import { NotificationItem } from './NotificationItem';
import type { NotificationGroup, NotificationTab } from './notificationTypes';

/** Day-grouped list with error, empty and end-of-list states. */
export function NotificationsList({
  loadError, groups, now, busy, onMarkRead, tab, hasActiveFilters, rangeDays, visibleCount, inRangeCount,
}: {
  loadError: boolean;
  groups: NotificationGroup[];
  now: number;
  busy: boolean;
  onMarkRead: (ids: string[]) => void;
  tab: NotificationTab;
  hasActiveFilters: boolean;
  rangeDays: number;
  visibleCount: number;
  inRangeCount: number;
}) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg">
      {loadError ? (
        <div className="px-6 py-12 text-center text-[13px]" style={{ color: 'var(--status-t10-fg)' }}>
          Notifications could not be loaded. Refresh the page to try again.
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-[13px] text-ui-text-secondary">
          <Bell size={28} className="opacity-40" aria-hidden />
          {hasActiveFilters
            ? 'No notifications match your filters.'
            : tab === 'unread' ? 'You’re all caught up — no unread notifications.' : `No notifications in the last ${rangeDays} days.`}
        </div>
      ) : (
        groups.map(g => {
          const groupUnread = g.rows.filter(n => !n.is_read).length;
          const label = groupLabel(g.day, now);
          return (
            <section key={g.day} aria-label={label}>
              <div className="flex items-baseline gap-2 border-b border-ui-divider px-4 py-3">
                <h2 className={cn('m-0 text-[12px] font-semibold', HEADING_TEXT)}>{label}</h2>
                <span className="text-[11px] text-ui-text-secondary">
                  {g.rows.length} update{g.rows.length === 1 ? '' : 's'}{groupUnread > 0 ? ` · ${groupUnread} unread` : ''}
                </span>
              </div>
              <ul className="m-0 list-none p-0">
                {g.rows.map(n => <NotificationItem key={n.id} n={n} now={now} busy={busy} onMarkRead={onMarkRead} />)}
              </ul>
            </section>
          );
        })
      )}
      {!loadError && groups.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 text-[12px] text-ui-text-secondary">
          <span>Showing {visibleCount} of {inRangeCount} notification{inRangeCount === 1 ? '' : 's'} from the last {rangeDays} days</span>
          <span className="inline-flex items-center gap-1.5"><CircleCheck size={14} aria-hidden /> End of notifications</span>
        </div>
      )}
    </div>
  );
}
