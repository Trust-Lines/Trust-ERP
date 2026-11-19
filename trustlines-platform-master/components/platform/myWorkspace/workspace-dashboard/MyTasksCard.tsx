'use client';

import Link from 'next/link';
import { ArrowUpRight, ClipboardList, ListChecks } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { HEADING } from '@/components/platform/shared/panelStyles';
import { isOverdue, SOURCE_LABEL, type MyTask } from '@/lib/myWorkspace/taskTypes';
import { cn } from '@/lib/utils';
import { CARD, STATUS_LABEL, STATUS_TONE, fmtDay, parseDay, type Loaded } from './dashboardData';

/** Top five open tasks, with the done checkbox. */
export function MyTasksCard({ tasks, openTasks, today, onToggle }: {
  tasks: Loaded<MyTask>;
  openTasks: MyTask[];
  today: string;
  onToggle: (t: MyTask, done: boolean) => void;
}) {
  return (
    <section aria-label="My Tasks" className={cn(CARD, 'flex min-w-0 flex-col gap-3 px-1 pb-2 pt-3')}>
      <header className="flex items-center justify-between gap-3 pl-4 pr-2">
        <span className="flex items-center gap-2">
          <h2 className={cn('m-0 text-[20px] font-semibold leading-[1.35]', HEADING)}>My Tasks</h2>
          {Array.isArray(tasks) && <span className={cn('rounded-[4px] bg-ui-surface px-[9px] py-[3px] text-[15px] font-semibold leading-[1.4]', HEADING)}>{openTasks.length}</span>}
        </span>
        <Link href="/workspace/tasks" className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-[var(--color-secondary-700)] px-3 text-[13px] font-medium text-white no-underline transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring dark:bg-primary-50 dark:text-primary-950">
          View All<span className="sr-only">: tasks</span><ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </header>
      <div className="flex max-h-[216px] flex-col gap-1 overflow-y-auto px-2">
        {tasks === null && <p role="status" className="m-0 py-8 text-center text-[13px] text-ui-text-secondary">Loading…</p>}
        {(tasks === 'error' || tasks === 'denied') && <p role="alert" className="m-0 py-8 text-center text-[13px] text-ui-text-secondary">Couldn’t load your tasks. Refresh to try again.</p>}
        {Array.isArray(tasks) && openTasks.length === 0 && (
          <p className="m-0 flex items-center justify-center gap-2 py-8 text-[13px] text-ui-text-secondary"><ListChecks className="size-4" aria-hidden /> No open tasks assigned to you.</p>
        )}
        {openTasks.slice(0, 5).map(t => {
          const late = isOverdue(t, today);
          return (
            <div key={`${t.source}-${t.id}`} className="flex min-h-9 items-center gap-3 rounded-[6px] bg-ui-surface pr-5 text-[13px]">
              <span className="flex w-12 shrink-0 justify-center">
                <Checkbox aria-label={`Mark “${t.title}” done`} checked={t.status === 'done'} disabled={!t.statusApi}
                  onCheckedChange={v => onToggle(t, !!v)} />
              </span>
              <Link href={t.record.href} className={cn('min-w-0 flex-1 truncate no-underline hover:underline', HEADING)}>{t.title}</Link>
              <span className="hidden w-[150px] shrink-0 sm:block">
                <span className="inline-flex items-center gap-1 rounded-[4px] py-[3px] pl-2 pr-2.5 text-[12px] font-medium leading-4"
                  style={{ background: `var(--status-${STATUS_TONE[t.status]}-bg)`, color: `var(--status-${STATUS_TONE[t.status]}-fg)` }}>
                  <ClipboardList className="size-3.5" aria-hidden />{STATUS_LABEL[t.status]}
                </span>
              </span>
              <span className="hidden w-[100px] shrink-0 truncate text-ui-text-secondary md:block">{SOURCE_LABEL[t.source]}</span>
              <span className={cn('w-[140px] shrink-0 truncate text-right', late ? 'font-semibold text-error-normal' : 'text-ui-text-secondary')}>
                {t.dueDate ? `${late ? 'Overdue · ' : ''}${fmtDay(parseDay(t.dueDate))}` : 'No date'}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
