'use client';

import { useState } from 'react';
import { ROLE_LABELS } from '@/components/platform/shell/Sidebar';
import { NotificationsHeader } from './NotificationsHeader';
import { NotificationsToolbar } from './NotificationsToolbar';
import { NotificationsList } from './NotificationsList';
import { useMarkRead } from './useMarkRead';
import { useNotificationFilters } from './useNotificationFilters';
import type { NotificationRow } from './notificationTypes';

export type { NotificationRow } from './notificationTypes';

export function NotificationsClient({ userId, role, notifications, loadError }: {
  userId: string;
  role: string;
  notifications: NotificationRow[];
  loadError: boolean;
}) {
  const [now] = useState(() => Date.now());
  const { items, busy, markRead } = useMarkRead(userId, notifications);
  const f = useNotificationFilters(items, now);

  const roleLabel = ROLE_LABELS[role] ?? 'Workspace';
  const totalUnread = items.filter(n => !n.is_read).length;

  return (
    <div className="flex flex-col gap-[18px]">
      <NotificationsHeader
        totalUnread={totalUnread}
        busy={busy}
        onMarkAllRead={() => markRead(items.filter(n => !n.is_read).map(n => n.id))}
      />

      <NotificationsToolbar
        tab={f.tab}
        onTabChange={f.setTab}
        allCount={f.inRange.length}
        unreadCount={f.unreadCount}
        query={f.query}
        onQueryChange={f.setQuery}
        types={f.types}
        typeFilter={f.typeFilter}
        onTypeFilterChange={f.setTypeFilter}
        rangeDays={f.rangeDays}
        onRangeDaysChange={f.setRangeDays}
      />

      <NotificationsList
        loadError={loadError}
        groups={f.groups}
        now={now}
        busy={busy}
        onMarkRead={ids => void markRead(ids)}
        tab={f.tab}
        hasActiveFilters={f.hasActiveFilters}
        rangeDays={f.rangeDays}
        visibleCount={f.visible.length}
        inRangeCount={f.inRange.length}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-ui-text-secondary">
        <span>All times in your local time zone · {roleLabel} workspace</span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-[var(--color-secondary-700)] dark:bg-ui-heading" /> Unread notification
        </span>
      </div>
    </div>
  );
}
