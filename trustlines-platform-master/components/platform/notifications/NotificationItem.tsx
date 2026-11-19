'use client';

import Link from 'next/link';
import { ArrowUpRight, Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HEADING_TEXT, actionLabel, iconFor, relativeTime, typeLabel } from './notificationFormat';
import type { NotificationRow } from './notificationTypes';

const LINK_CLASS = 'inline-flex items-center gap-1.5 text-[12px] font-medium text-ui-link no-underline hover:underline';

export function NotificationItem({ n, now, busy, onMarkRead }: {
  n: NotificationRow;
  now: number;
  busy: boolean;
  onMarkRead: (ids: string[]) => void;
}) {
  const Icon = iconFor(n.type);
  const when = relativeTime(n.created_at, now);
  const unread = !n.is_read;
  const meta = [typeLabel(n.type), n.project?.code, n.project?.name].filter(Boolean).join(' · ');
  const internal = n.link?.startsWith('/');
  const onOpen = () => { if (unread) onMarkRead([n.id]); };

  return (
    <li className={cn('flex items-center gap-3 border-b border-ui-divider px-4 py-4', unread ? 'bg-ui-surface' : 'bg-ui-page-bg')}>
      <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', unread ? 'bg-[var(--color-secondary-700)] dark:bg-ui-heading' : 'bg-transparent')} />
      <span className="grid size-8 shrink-0 place-items-center rounded-[6px] border border-ui-divider bg-ui-page-bg text-ui-body">
        <Icon size={16} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={cn('text-[13px]', unread ? 'font-semibold' : 'font-medium', HEADING_TEXT)}>
          {unread && <span className="sr-only">Unread: </span>}{n.title}
        </span>
        {n.body && <span className="text-[12px] text-ui-body">{n.body}</span>}
        <span className="text-[11px] text-ui-text-secondary">{meta}</span>
      </div>
      <div className="w-[120px] shrink-0 text-right text-[11px] leading-[1.45]">
        <div className="text-ui-body">{when.primary}</div>
        <div className="text-ui-text-secondary">{when.secondary}</div>
      </div>
      <div className="flex w-[150px] shrink-0 justify-end">
        {n.link && (internal ? (
          <Link href={n.link} onClick={onOpen} className={LINK_CLASS}>
            {actionLabel(n.link)} <ArrowUpRight size={14} aria-hidden />
          </Link>
        ) : (
          <a href={n.link} target="_blank" rel="noreferrer" onClick={onOpen} className={LINK_CLASS}>
            Open <ArrowUpRight size={14} aria-hidden />
          </a>
        ))}
      </div>
      <button
        type="button"
        disabled={busy || !unread}
        onClick={() => onMarkRead([n.id])}
        title={unread ? 'Mark as read' : 'Read'}
        aria-label={unread ? `Mark "${n.title}" as read` : 'Already read'}
        className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-[6px] border-0 bg-transparent text-ui-text-secondary hover:bg-ui-hover-bg disabled:cursor-default disabled:hover:bg-transparent"
      >
        {unread ? <Check size={16} aria-hidden /> : <CheckCheck size={16} aria-hidden />}
      </button>
    </li>
  );
}
