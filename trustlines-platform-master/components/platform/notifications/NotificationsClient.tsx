'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight, Bell, CalendarClock, CalendarDays, Check, CheckCheck, CircleCheck, ClipboardCheck,
  Clock, Handshake, ListFilter, MessagesSquare, Search, Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Select } from '@/components/platform/shared/Select';
import { ROLE_LABELS } from '@/components/platform/shell/Sidebar';

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean | null;
  created_at: string;
  project_id: string | null;
  project: { code: string; name: string } | null;
}

type Tab = 'all' | 'unread';

// Figma "Notifications" (node 168:25189).
const HEADING_TEXT = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const CONTROL_STYLE: React.CSSProperties = {
  height: 40, fontSize: 12, borderRadius: 6, borderColor: 'var(--ui-input-border)', background: 'var(--ui-input-bg)',
};
const RANGES = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
];
const DAY_MS = 86_400_000;

const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' });
const DAY_LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const DAY_SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const DATE_SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "lead.followup" → "Lead followup" */
function typeLabel(type: string): string {
  const s = type.replace(/[._]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function iconFor(type: string) {
  const t = type.toLowerCase();
  if (/(approval|review)/.test(t)) return Clock;
  if (/(followup|reminder)/.test(t)) return CalendarClock;
  if (/(lead|opportunit|deal)/.test(t)) return Handshake;
  if (/(deliver|shipment|logistic|dispatch)/.test(t)) return Truck;
  if (/(mention|comment|message|discussion)/.test(t)) return MessagesSquare;
  if (/(complete|approved|done)/.test(t)) return CircleCheck;
  return ClipboardCheck;
}

function actionLabel(link: string): string {
  if (link.startsWith('/projects')) return 'Open project';
  if (link.startsWith('/marketing/opportunities')) return 'Open opportunity';
  if (link.startsWith('/marketing/prospects')) return 'Open contact';
  if (link.startsWith('/sales')) return 'Open lead';
  if (link.startsWith('/approvals')) return 'Review';
  return 'Open';
}

function relativeTime(iso: string, now: number): { primary: string; secondary: string } {
  const at = new Date(iso);
  const diffMin = Math.max(0, Math.floor((now - at.getTime()) / 60_000));
  const time = TIME.format(at);
  const today = startOfDay(new Date(now));
  if (at.getTime() >= today) {
    if (diffMin < 1) return { primary: 'Just now', secondary: time };
    if (diffMin < 60) return { primary: `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`, secondary: time };
    const h = Math.floor(diffMin / 60);
    return { primary: `${h} hour${h === 1 ? '' : 's'} ago`, secondary: time };
  }
  if (at.getTime() >= today - DAY_MS) return { primary: 'Yesterday', secondary: `${DAY_SHORT.format(at)} · ${time}` };
  return { primary: DATE_SHORT.format(at), secondary: time };
}

function groupLabel(dayStart: number, now: number): string {
  const today = startOfDay(new Date(now));
  const long = DAY_LONG.format(new Date(dayStart));
  if (dayStart === today) return `Today · ${long}`;
  if (dayStart === today - DAY_MS) return `Yesterday · ${long}`;
  return long;
}

export function NotificationsClient({ userId, role, notifications, loadError }: {
  userId: string;
  role: string;
  notifications: NotificationRow[];
  loadError: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(notifications);
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [rangeDays, setRangeDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());

  const roleLabel = ROLE_LABELS[role] ?? 'Workspace';
  const inRange = useMemo(() => items.filter(n => new Date(n.created_at).getTime() >= now - rangeDays * DAY_MS), [items, now, rangeDays]);
  const unreadCount = inRange.filter(n => !n.is_read).length;
  const totalUnread = items.filter(n => !n.is_read).length;
  const types = useMemo(() => [...new Set(items.map(n => n.type))].sort(), [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inRange
      .filter(n => tab === 'all' || !n.is_read)
      .filter(n => !typeFilter || n.type === typeFilter)
      .filter(n => !q || [n.title, n.body ?? '', n.project?.code ?? '', n.project?.name ?? ''].some(v => v.toLowerCase().includes(q)));
  }, [inRange, tab, typeFilter, query]);

  const groups = useMemo(() => {
    const out: { day: number; rows: NotificationRow[] }[] = [];
    for (const n of visible) {
      const day = startOfDay(new Date(n.created_at));
      const last = out[out.length - 1];
      if (last && last.day === day) last.rows.push(n);
      else out.push({ day, rows: [n] });
    }
    return out;
  }, [visible]);

  // RLS "own_notifications" lets a user update only their own rows — no API route needed.
  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    setBusy(true);
    const prev = items;
    setItems(list => list.map(n => (ids.includes(n.id) ? { ...n, is_read: true } : n)));
    const { error } = await createClient()
      .from('notifications')
      .update({ is_read: true } as never)
      .eq('user_id', userId)
      .in('id', ids);
    setBusy(false);
    if (error) {
      setItems(prev);
      toast.error('Could not mark as read');
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-[5px] leading-[1.35]">
          <p className="m-0 text-[11px] font-semibold uppercase text-ui-nav-active">Workspace / {roleLabel}</p>
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
          onClick={() => markRead(items.filter(n => !n.is_read).map(n => n.id))}
          className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-ui-input-border bg-ui-input-bg px-3 text-[12px] font-medium text-ui-body hover:bg-ui-hover-bg disabled:opacity-50 [&_svg]:size-4"
        >
          <CheckCheck aria-hidden /> Mark all as read
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div role="tablist" aria-label="Notification views" className="flex gap-2">
          {([['all', 'All', inRange.length], ['unread', 'Unread', unreadCount]] as const).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
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
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <ListFilter size={14} className="text-ui-text-secondary" aria-hidden />
            <Select className="form-input" style={{ ...CONTROL_STYLE, minWidth: 130 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="Filter by type">
              <option value="">All types</option>
              {types.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarDays size={14} className="text-ui-text-secondary" aria-hidden />
            <Select className="form-input" style={{ ...CONTROL_STYLE, minWidth: 130 }} value={String(rangeDays)} onChange={e => setRangeDays(Number(e.target.value))} aria-label="Date range">
              {RANGES.map(r => <option key={r.days} value={r.days}>{r.label}</option>)}
            </Select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[8px] border border-ui-divider bg-ui-page-bg">
        {loadError ? (
          <div className="px-6 py-12 text-center text-[13px]" style={{ color: 'var(--status-t10-fg)' }}>
            Notifications could not be loaded. Refresh the page to try again.
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-[13px] text-ui-text-secondary">
            <Bell size={28} className="opacity-40" aria-hidden />
            {query.trim() || typeFilter
              ? 'No notifications match your filters.'
              : tab === 'unread' ? 'You’re all caught up — no unread notifications.' : `No notifications in the last ${rangeDays} days.`}
          </div>
        ) : (
          groups.map(g => {
            const groupUnread = g.rows.filter(n => !n.is_read).length;
            return (
              <section key={g.day} aria-label={groupLabel(g.day, now)}>
                <div className="flex items-baseline gap-2 border-b border-ui-divider px-4 py-3">
                  <h2 className={cn('m-0 text-[12px] font-semibold', HEADING_TEXT)}>{groupLabel(g.day, now)}</h2>
                  <span className="text-[11px] text-ui-text-secondary">
                    {g.rows.length} update{g.rows.length === 1 ? '' : 's'}{groupUnread > 0 ? ` · ${groupUnread} unread` : ''}
                  </span>
                </div>
                <ul className="m-0 list-none p-0">
                  {g.rows.map(n => {
                    const Icon = iconFor(n.type);
                    const when = relativeTime(n.created_at, now);
                    const unread = !n.is_read;
                    const meta = [typeLabel(n.type), n.project?.code, n.project?.name].filter(Boolean).join(' · ');
                    const internal = n.link?.startsWith('/');
                    return (
                      <li
                        key={n.id}
                        className={cn('flex items-center gap-3 border-b border-ui-divider px-4 py-4', unread ? 'bg-ui-surface' : 'bg-ui-page-bg')}
                      >
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
                            <Link
                              href={n.link}
                              onClick={() => { if (unread) void markRead([n.id]); }}
                              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ui-link no-underline hover:underline"
                            >
                              {actionLabel(n.link)} <ArrowUpRight size={14} aria-hidden />
                            </Link>
                          ) : (
                            <a
                              href={n.link}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => { if (unread) void markRead([n.id]); }}
                              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ui-link no-underline hover:underline"
                            >
                              Open <ArrowUpRight size={14} aria-hidden />
                            </a>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={busy || !unread}
                          onClick={() => markRead([n.id])}
                          title={unread ? 'Mark as read' : 'Read'}
                          aria-label={unread ? `Mark "${n.title}" as read` : 'Already read'}
                          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-[6px] border-0 bg-transparent text-ui-text-secondary hover:bg-ui-hover-bg disabled:cursor-default disabled:hover:bg-transparent"
                        >
                          {unread ? <Check size={16} aria-hidden /> : <CheckCheck size={16} aria-hidden />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}
        {!loadError && groups.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 text-[12px] text-ui-text-secondary">
            <span>Showing {visible.length} of {inRange.length} notification{inRange.length === 1 ? '' : 's'} from the last {rangeDays} days</span>
            <span className="inline-flex items-center gap-1.5"><CircleCheck size={14} aria-hidden /> End of notifications</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-ui-text-secondary">
        <span>All times in your local time zone · {roleLabel} workspace</span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-[var(--color-secondary-700)] dark:bg-ui-heading" /> Unread notification
        </span>
      </div>
    </div>
  );
}
