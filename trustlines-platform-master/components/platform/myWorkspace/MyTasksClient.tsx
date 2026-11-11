'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ListChecks, Search } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/feedback-states';
import { PANEL, TD_CLS, TH_CLS } from '@/components/platform/marketing/pr/shared';
import { formatDate } from '@/lib/formatDate';
import { cn } from '@/lib/utils';
import { SOURCE_LABEL, byUrgency, isOpen, isOverdue, todayKey, type MyTask, type MyTaskStatus } from '@/lib/myWorkspace/taskTypes';

// My Workspace → My Tasks, "Assigned to me": tasks from the existing task tables (Sales /
// Marketing deal tasks, customer follow-ups) assigned to the signed-in person
// (GET /api/my-workspace/tasks). Status changes go to each task's own API, so the department
// pages see the same change. No priority filter: none of the task tables has a priority.

const STATUS_LABEL: Record<MyTaskStatus, string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
const STATUS_TONE: Record<MyTaskStatus, string> = { todo: 't2', in_progress: 't7', done: 't9' };
const LEAD_STATUS_OPTIONS = (['todo', 'in_progress', 'done'] as const).map(s => ({ value: s, label: STATUS_LABEL[s] }));
const FOLLOW_UP_OPTIONS = [{ value: 'todo', label: 'Open' }, { value: 'done', label: 'Done' }];

const STATUS_FILTERS = [
  { value: 'open', label: 'Open' }, { value: 'todo', label: 'To Do' }, { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done (last 30 days)' }, { value: 'all', label: 'All' },
];
const DUE_FILTERS = [
  { value: '', label: 'Any due date' }, { value: 'overdue', label: 'Overdue' }, { value: 'today', label: 'Due today' },
  { value: 'week', label: 'Due in 7 days' }, { value: 'none', label: 'No due date' },
];
const FILTER = 'h-9 w-auto min-w-[150px]';

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return todayKey(new Date(y, m - 1, d + n));
}

export function MyTasksClient() {
  const router = useRouter();
  const [tasks, setTasks] = useState<MyTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [fStatus, setFStatus] = useState('open');
  const [fDue, setFDue] = useState('');
  const [fSource, setFSource] = useState('');
  const [fRecord, setFRecord] = useState('');
  const [query, setQuery] = useState('');
  const [today] = useState(() => todayKey());

  const load = useCallback(async () => {
    const res = await fetch('/api/my-workspace/tasks').catch(() => null);
    const body = await res?.json().catch(() => ({})) as { tasks?: MyTask[]; error?: string } | undefined;
    if (!res?.ok) { setError(body?.error ?? 'Could not load your tasks.'); setTasks(prev => prev ?? []); return; }
    setError(null);
    setTasks(body?.tasks ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function setStatus(t: MyTask, status: MyTaskStatus) {
    if (!t.statusApi || status === t.status) return;
    setBusy(t.id);
    setTasks(list => list?.map(x => (x.id === t.id ? { ...x, status } : x)) ?? null);
    const follow = t.statusApi.kind === 'follow_up';
    const res = await fetch(t.statusApi.url, {
      method: follow ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: follow ? (status === 'done' ? 'done' : 'open') : status }),
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) {
      setTasks(list => list?.map(x => (x.id === t.id ? { ...x, status: t.status } : x)) ?? null);
      toast.error('Could not save the status');
      return;
    }
    if (status === 'done') toast.success('Task done');
    // Counters elsewhere (overview, department pages) read the same rows.
    router.refresh();
  }

  const all = useMemo(() => tasks ?? [], [tasks]);
  const sources = useMemo(() => [...new Set(all.map(t => t.source))], [all]);
  const records = useMemo(() => [...new Map(all.map(t => [t.record.href, t.record.label])).entries()]
    .map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)), [all]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const week = addDays(today, 7);
    return all.filter(t => {
      if (fStatus === 'open' && !isOpen(t)) return false;
      if (fStatus !== 'open' && fStatus !== 'all' && t.status !== fStatus) return false;
      if (fDue === 'overdue' && !isOverdue(t, today)) return false;
      if (fDue === 'today' && t.dueDate !== today) return false;
      if (fDue === 'week' && !(t.dueDate && t.dueDate >= today && t.dueDate <= week)) return false;
      if (fDue === 'none' && t.dueDate) return false;
      if (fSource && t.source !== fSource) return false;
      if (fRecord && t.record.href !== fRecord) return false;
      if (q && !`${t.title} ${t.record.label}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort(byUrgency);
  }, [all, fStatus, fDue, fSource, fRecord, query, today]);

  const openCount = all.filter(isOpen).length;
  const overdueCount = all.filter(t => isOverdue(t, today)).length;

  return (
    <section aria-label="Assigned to me" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 flex items-center gap-2 text-[18px] font-semibold text-[var(--color-secondary-700)] dark:text-ui-heading">
          Assigned to me
          {tasks && (
            <span className="text-[12px] font-normal text-ui-text-secondary">
              {openCount} open{overdueCount > 0 && <> · <span className="font-semibold text-error-normal">{overdueCount} overdue</span></>}
            </span>
          )}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-[240px] max-w-full">
            <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-secondary" />
            <input
              type="search" aria-label="Search tasks" placeholder="Search tasks…" value={query} onChange={e => setQuery(e.target.value)}
              className="h-9 w-full rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-8 pr-2.5 text-[13px] text-ui-heading outline-none placeholder:text-ui-text-secondary focus-visible:outline-2 focus-visible:outline-ui-focus-ring"
            />
          </div>
          <Select aria-label="Status" className={FILTER} options={STATUS_FILTERS} value={fStatus} onValueChange={v => setFStatus(v ?? 'open')} />
          <Select aria-label="Due date" className={FILTER} options={DUE_FILTERS} value={fDue} onValueChange={v => setFDue(v ?? '')} />
          {sources.length > 1 && (
            <Select aria-label="Department" className={FILTER} value={fSource} onValueChange={v => setFSource(v ?? '')}
              options={[{ value: '', label: 'All departments' }, ...sources.map(s => ({ value: s, label: SOURCE_LABEL[s] }))]} />
          )}
          {records.length > 1 && (
            <Select aria-label="Project or deal" className={cn(FILTER, 'max-w-[220px]')} value={fRecord} onValueChange={v => setFRecord(v ?? '')}
              options={[{ value: '', label: 'All projects & deals' }, ...records]} />
          )}
        </div>
      </div>

      <div className={cn(PANEL, 'overflow-hidden')}>
        {!tasks ? (
          <p role="status" className="m-0 p-6 text-center text-[13px] text-ui-text-secondary">Loading your tasks…</p>
        ) : error && all.length === 0 ? (
          <div className="p-6"><ErrorState title="Tasks aren’t available" description={error} /></div>
        ) : visible.length === 0 ? (
          <EmptyState size="sm" className="p-8" icon={<ListChecks />}
            title={all.length === 0 ? 'No tasks are assigned to you.' : 'No tasks match these filters.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-ui-divider bg-ui-surface">
                  <th scope="col" className={TH_CLS}>Task</th>
                  <th scope="col" className={TH_CLS}>Project / deal</th>
                  <th scope="col" className={TH_CLS}>Department</th>
                  <th scope="col" className={TH_CLS}>Due</th>
                  <th scope="col" className={TH_CLS}>Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(t => {
                  const late = isOverdue(t, today);
                  const tone = STATUS_TONE[t.status];
                  return (
                    <tr key={`${t.source}-${t.id}`} className={cn('border-b border-ui-divider last:border-b-0', late && 'bg-error-light/40')}>
                      <td className={cn(TD_CLS, 'max-w-[340px]')}>
                        <span className={cn('block truncate text-[13px] font-medium text-ui-heading', t.status === 'done' && 'text-ui-text-secondary line-through')} title={t.title}>{t.title}</span>
                      </td>
                      <td className={cn(TD_CLS, 'max-w-[220px]')}>
                        <Link href={t.record.href} className="block truncate text-ui-link no-underline hover:underline" title={t.record.label}>{t.record.label}</Link>
                      </td>
                      <td className={TD_CLS}>{SOURCE_LABEL[t.source]}</td>
                      <td className={cn(TD_CLS, 'whitespace-nowrap')}>
                        {late ? (
                          <span className="inline-flex items-center rounded-[4px] px-2 py-0.5 font-semibold" style={{ background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' }}>
                            Overdue · {formatDate(t.dueDate)}
                          </span>
                        ) : formatDate(t.dueDate)}
                      </td>
                      <td className={TD_CLS}>
                        {t.statusApi ? (
                          <Select
                            aria-label={`Status of ${t.title}`}
                            disabled={busy === t.id}
                            className="h-8 w-auto min-w-[130px] text-[12px]"
                            options={t.statusApi.kind === 'follow_up' ? FOLLOW_UP_OPTIONS : LEAD_STATUS_OPTIONS}
                            value={t.statusApi.kind === 'follow_up' && t.status !== 'done' ? 'todo' : t.status}
                            onValueChange={v => v && void setStatus(t, v as MyTaskStatus)}
                          />
                        ) : (
                          <span className="inline-flex rounded-[4px] px-2 py-0.5 text-[12px] font-medium" style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}>
                            {t.source === 'customers' && t.status !== 'done' ? 'Open' : STATUS_LABEL[t.status]}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
