'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { HrCalendar } from '@/components/platform/hr/HrCalendar';
import { dayKey } from '@/components/platform/hr/tones';
import type { HrCalendarEvent, HrEventKind } from '@/components/platform/hr/types';
import { MyMeetingsClient } from '@/components/platform/meetings/MyMeetingsClient';
import { isOpen, type MyTask } from '@/lib/myWorkspace/taskTypes';

// My Workspace → Calendar & Meetings: a month view of what is the person's own — their Google
// Calendar meetings (GET /api/me/meetings, their own synced copy) and the due dates of their open
// tasks (GET /api/my-workspace/tasks) — plus Turkey's holidays (HrCalendar adds those). Below it,
// the meetings list with Schedule / Sync / Cancel (MyMeetingsClient). Department calendars (HR
// team calendar, Marketing content calendar) stay on their own pages and are not copied in.
// Times are shown in the browser's time zone, like the rest of the app.

const LEGEND: HrEventKind[] = ['meeting', 'task', 'holiday', 'special'];
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

interface Meeting { id: string; title: string; starts_at: string; all_day: boolean; html_link: string | null; status: string }

export function MyCalendarClient() {
  const [today] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // Upcoming (next 120 days) and past (last 60) are the two windows the meetings API serves.
    const get = (url: string) => fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const [up, past, t] = await Promise.all([get('/api/me/meetings?range=upcoming'), get('/api/me/meetings?range=past'), get('/api/my-workspace/tasks')]);
    setMeetings([...(past?.meetings ?? []), ...(up?.meetings ?? [])]);
    setTasks(t?.tasks ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const events = useMemo<HrCalendarEvent[]>(() => [
    ...meetings.filter(m => m.status !== 'cancelled').map(m => {
      const at = new Date(m.starts_at);
      return {
        id: `meeting-${m.id}`, kind: 'meeting' as const, date: dayKey(at),
        label: m.all_day ? m.title : `${TIME.format(at)} ${m.title}`,
        href: m.html_link ?? undefined,
      };
    }),
    ...tasks.filter(t => isOpen(t) && t.dueDate).map(t => ({
      id: `task-${t.source}-${t.id}`, kind: 'task' as const, date: t.dueDate!, label: t.title, href: t.record.href,
    })),
  ], [meetings, tasks]);

  return (
    <div className="flex flex-col gap-8">
      <HrCalendar month={month} onMonthChange={setMonth} events={events} today={today} loading={loading} legend={LEGEND} />
      <MyMeetingsClient onChanged={load} />
    </div>
  );
}
