'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CalendarDays, CheckSquare, CircleAlert, ListChecks, MessagesSquare } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { EmptyState } from '@/components/ui/empty-state';
import { PANEL } from '@/components/platform/marketing/pr/shared';
import { DOC_LABELS } from '@/components/platform/approvals/docLabels';
import { createClient } from '@/lib/supabase/client';
import { byUrgency, isOpen, isOverdue, todayKey, SOURCE_LABEL, type MyTask } from '@/lib/myWorkspace/taskTypes';
import type { MyApproval } from '@/lib/approvals/mine';
import { formatDate } from '@/lib/formatDate';
import { cn } from '@/lib/utils';

// My Workspace → Overview. Each card and list reads the same endpoint as the page it links to,
// so a number and the list behind it are always the same set:
//   tasks          GET /api/my-workspace/tasks
//   approvals      GET /api/approvals/mine  +  GET /api/hr/requests?scope=team (pending)
//   meetings       GET /api/me/meetings?range=upcoming (the person's own Google Calendar copy)
//   notifications  the person's own rows (RLS "own_notifications"), like the bell
// Messages: the ERP has no messaging backend yet, so that card says so instead of a number.
// Dates and times are the browser's, like the rest of the app.

const LIST_SIZE = 5;
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const ROW = 'flex items-center gap-3 border-b border-ui-divider px-5 py-3 text-[13px] no-underline last:border-b-0 hover:bg-ui-hover-bg';
const DASH = '—';

type Loaded<T> = { ok: true; value: T } | { ok: false } | null;
interface HrPending { id: string; user_id: string; kind: string; reason: string | null; status: string; created_at: string }
interface Meeting { id: string; title: string; starts_at: string; all_day: boolean; html_link: string | null }
interface Notice { id: string; title: string; link: string | null; is_read: boolean | null; created_at: string }

async function getJson<T>(url: string, pick: (b: Record<string, unknown>) => T): Promise<Loaded<T>> {
  const res = await fetch(url).catch(() => null);
  if (!res?.ok) return { ok: false };
  const body = await res.json().catch(() => null);
  return body ? { ok: true, value: pick(body) } : { ok: false };
}

function Panel({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className={cn(PANEL, 'flex min-w-0 flex-col')}>
      <header className="flex items-center justify-between gap-3 border-b border-ui-divider px-5 py-3.5">
        <h2 className="m-0 text-[15px] font-semibold text-[var(--color-secondary-700)] dark:text-ui-heading">{title}</h2>
        <Link href={href} className="text-[12px] font-medium text-ui-link no-underline hover:underline">View all</Link>
      </header>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

function Body<T>({ data, what, empty, children }: { data: Loaded<T>; what: string; empty: React.ReactNode | false; children: (v: T) => React.ReactNode }) {
  if (data === null) return <p role="status" className="m-0 px-5 py-6 text-[13px] text-ui-text-secondary">Loading…</p>;
  if (!data.ok) return <p role="alert" className="m-0 px-5 py-6 text-[13px] text-ui-text-secondary">Couldn’t load {what}. Refresh to try again.</p>;
  return <>{empty || children(data.value)}</>;
}

export function WorkspaceOverview({ userId }: { userId: string }) {
  const router = useRouter();
  const [today] = useState(() => todayKey());
  const [tasks, setTasks] = useState<Loaded<MyTask[]>>(null);
  const [docs, setDocs] = useState<Loaded<MyApproval[]>>(null);
  const [hr, setHr] = useState<Loaded<{ rows: HrPending[]; names: Record<string, string> }>>(null);
  const [meetings, setMeetings] = useState<Loaded<Meeting[]>>(null);
  const [notices, setNotices] = useState<Loaded<{ unread: number; recent: Notice[] }>>(null);

  const loadNotices = useCallback(async () => {
    const sb = createClient();
    const [count, recent] = await Promise.all([
      sb.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false),
      sb.from('notifications').select('id, title, link, is_read, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(LIST_SIZE),
    ]);
    setNotices(count.error || recent.error ? { ok: false } : { ok: true, value: { unread: count.count ?? 0, recent: (recent.data ?? []) as Notice[] } });
  }, [userId]);

  useEffect(() => {
    void getJson('/api/my-workspace/tasks', b => (b.tasks ?? []) as MyTask[]).then(setTasks);
    void getJson('/api/approvals/mine', b => (b.approvals ?? []) as MyApproval[]).then(setDocs);
    // 503 = HR not set up (migration 145): no HR approvals rather than an error.
    void fetch('/api/hr/requests?scope=team').then(async r => {
      if (r.status === 503) return setHr({ ok: true, value: { rows: [], names: {} } });
      const b = r.ok ? await r.json().catch(() => null) : null;
      setHr(b ? { ok: true, value: { rows: ((b.requests ?? []) as HrPending[]).filter(x => x.status === 'pending'), names: b.names ?? {} } } : { ok: false });
    }).catch(() => setHr({ ok: false }));
    // 412/503 = Google not connected / meetings not set up: shown as such, not as an error.
    void fetch('/api/me/meetings?range=upcoming').then(async r => {
      const b = r.ok ? await r.json().catch(() => null) : null;
      setMeetings(b ? { ok: true, value: b.connection ? (b.meetings ?? []) as Meeting[] : [] } : { ok: false });
    }).catch(() => setMeetings({ ok: false }));
    void loadNotices();
  }, [loadNotices]);

  async function openNotice(n: Notice) {
    if (n.is_read) return;
    await createClient().from('notifications').update({ is_read: true } as never).eq('user_id', userId).eq('id', n.id);
    void loadNotices();
    router.refresh(); // the top-bar bell count
  }

  const open = useMemo(() => (tasks?.ok ? tasks.value.filter(isOpen).sort(byUrgency) : []), [tasks]);
  const overdue = open.filter(t => isOverdue(t, today));
  const approvals = useMemo(() => (docs?.ok && hr?.ok ? [
    ...docs.value.map(d => ({
      key: `doc-${d.approvalId}`, at: d.createdAt, href: `/projects/${d.projectId}`,
      title: `${DOC_LABELS[d.docType] ?? d.docType} · V${d.versionNum ?? d.version}`,
      sub: `${[d.projectCode, d.projectName].filter(Boolean).join(' — ')} · your step: ${d.stageLabel}`,
    })),
    ...hr.value.rows.map(r => ({
      key: `hr-${r.id}`, at: r.created_at, href: '/workspace/approvals',
      title: r.kind === 'leave' ? `${r.reason ? r.reason.charAt(0).toUpperCase() + r.reason.slice(1) : 'Leave'} leave request` : 'Punch correction request',
      sub: `HR · ${hr.value.names[r.user_id] ?? 'Team member'}`,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at)) : []), [docs, hr]);
  const approvalsLoaded: Loaded<typeof approvals> = docs === null || hr === null ? null : docs.ok && hr.ok ? { ok: true, value: approvals } : { ok: false };
  const todayDay = DAY.format(new Date());
  const meetingsToday = meetings?.ok ? meetings.value.filter(m => DAY.format(new Date(m.starts_at)) === todayDay).length : 0;

  return (
    <div className="flex flex-col gap-[30px]">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard icon={<ListChecks />} label="Open tasks" loading={tasks === null} value={tasks?.ok ? open.length : DASH} href="/workspace/tasks" />
        <KpiCard icon={<CircleAlert />} label="Overdue tasks" loading={tasks === null} value={tasks?.ok ? overdue.length : DASH} href="/workspace/tasks"
          badge={overdue.length ? { label: 'Needs attention', tone: 'error' } : undefined} />
        <KpiCard icon={<CheckSquare />} label="Waiting for my approval" loading={approvalsLoaded === null} value={approvalsLoaded?.ok ? approvals.length : DASH} href="/workspace/approvals" />
        <KpiCard icon={<CalendarDays />} label="Meetings today" loading={meetings === null} value={meetings?.ok ? meetingsToday : DASH} href="/workspace/calendar"
          badge={meetings?.ok && meetings.value.length ? { label: `${meetings.value.length} upcoming`, tone: 'neutral' } : undefined} />
        <KpiCard icon={<MessagesSquare />} label="Unread messages" value={DASH} href="/workspace/messages" badge={{ label: 'Not connected', tone: 'neutral' }} />
        <KpiCard icon={<Bell />} label="Unread notifications" loading={notices === null} value={notices?.ok ? notices.value.unread : DASH} href="/workspace/notifications" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="My tasks" href="/workspace/tasks">
          <Body data={tasks} what="your tasks" empty={tasks?.ok && open.length === 0 && <EmptyState size="sm" className="py-8" icon={<ListChecks />} title="No open tasks assigned to you." />}>
            {() => open.slice(0, LIST_SIZE).map(t => {
              const late = isOverdue(t, today);
              return (
                <Link key={`${t.source}-${t.id}`} href={t.record.href} className={ROW}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ui-heading">{t.title}</span>
                    <span className="block truncate text-[12px] text-ui-text-secondary">{SOURCE_LABEL[t.source]} · {t.record.label}</span>
                  </span>
                  <span className={cn('shrink-0 text-[12px]', late ? 'font-semibold text-error-normal' : 'text-ui-text-secondary')}>
                    {t.dueDate ? `${late ? 'Overdue · ' : ''}${formatDate(t.dueDate)}` : 'No date'}
                  </span>
                </Link>
              );
            })}
          </Body>
        </Panel>

        <Panel title="Waiting for my approval" href="/workspace/approvals">
          <Body data={approvalsLoaded} what="your approvals" empty={approvalsLoaded?.ok && approvals.length === 0 && <EmptyState size="sm" className="py-8" icon={<CheckSquare />} title="Nothing is waiting for your approval." />}>
            {list => list.slice(0, LIST_SIZE).map(r => (
              <Link key={r.key} href={r.href} className={ROW}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ui-heading">{r.title}</span>
                  <span className="block truncate text-[12px] text-ui-text-secondary">{r.sub}</span>
                </span>
                <span className="shrink-0 text-[12px] text-ui-text-secondary">{formatDate(r.at)}</span>
              </Link>
            ))}
          </Body>
        </Panel>

        <Panel title="Today & upcoming meetings" href="/workspace/calendar">
          <Body data={meetings} what="your meetings" empty={meetings?.ok && meetings.value.length === 0 && <EmptyState size="sm" className="py-8" icon={<CalendarDays />} title="Nothing scheduled." description="Meetings come from your Google Calendar (Settings → Google account)." />}>
            {list => list.slice(0, LIST_SIZE).map(m => {
              const at = new Date(m.starts_at);
              const body = (
                <>
                  <span className="w-[120px] shrink-0 text-[12px] tabular-nums text-ui-text-secondary">
                    {DAY.format(at) === todayDay ? 'Today' : DAY.format(at)}{m.all_day ? '' : ` · ${TIME.format(at)}`}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-ui-heading">{m.title}</span>
                </>
              );
              return m.html_link
                ? <a key={m.id} href={m.html_link} target="_blank" rel="noreferrer" className={ROW}>{body}</a>
                : <Link key={m.id} href="/workspace/calendar" className={ROW}>{body}</Link>;
            })}
          </Body>
        </Panel>

        <Panel title="Recent notifications" href="/workspace/notifications">
          <Body data={notices} what="your notifications" empty={notices?.ok && notices.value.recent.length === 0 && <EmptyState size="sm" className="py-8" icon={<Bell />} title="No notifications yet." />}>
            {v => v.recent.map(n => {
              const href = n.link || '/workspace/notifications';
              const inner = (
                <>
                  <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', n.is_read ? 'bg-transparent' : 'bg-[var(--color-secondary-700)] dark:bg-ui-heading')} />
                  <span className={cn('min-w-0 flex-1 truncate text-ui-heading', n.is_read ? 'font-normal' : 'font-semibold')}>
                    {!n.is_read && <span className="sr-only">Unread: </span>}{n.title}
                  </span>
                  <span className="shrink-0 text-[12px] text-ui-text-secondary">{formatDate(n.created_at)}</span>
                </>
              );
              return /^https?:\/\//.test(href)
                ? <a key={n.id} href={href} target="_blank" rel="noreferrer" onClick={() => void openNotice(n)} className={ROW}>{inner}</a>
                : <Link key={n.id} href={href} onClick={() => void openNotice(n)} className={ROW}>{inner}</Link>;
            })}
          </Body>
        </Panel>
      </div>
    </div>
  );
}
