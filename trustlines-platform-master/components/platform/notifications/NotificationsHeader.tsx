'use client';

import { CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { HEADING_TEXT } from './notificationFormat';

export function NotificationsHeader({ totalUnread, busy, onMarkAllRead }: {
  totalUnread: number;
  busy: boolean;
  onMarkAllRead: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'My Workspace', href: '/workspace' }, { label: 'Notifications', href: '/workspace/notifications' }]} />
        <div className="flex items-center gap-3">
          <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING_TEXT)}>Notifications</h1>
          {totalUnread > 0 && (
            <span className="rounded-[4px] bg-ui-selected-bg px-2 py-0.5 text-[11px] font-semibold text-[var(--color-secondary-700)] dark:text-ui-heading">
              {totalUnread} unread
            </span>
          )}
        </div>
        <p className="m-0 text-[13px] text-ui-body">Your updates, mentions and reminders across projects and operations.</p>
      </div>
      <button
        type="button"
        disabled={busy || totalUnread === 0}
        onClick={onMarkAllRead}
        className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-ui-input-border bg-ui-input-bg px-3 text-[12px] font-medium text-ui-body hover:bg-ui-hover-bg disabled:opacity-50 [&_svg]:size-4"
      >
        <CheckCheck aria-hidden /> Mark all as read
      </button>
    </div>
  );
}
