'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FIELD, HEADING, PANEL, PANEL_HEAD, PANEL_TITLE } from './panelStyles';

const SMALL_FIELD = 'h-8 rounded-[6px] border-ui-input-border bg-ui-input-bg px-2 text-[12px] text-[var(--color-secondary-700)] dark:rounded-[6px] dark:border-ui-input-border dark:bg-ui-input-bg dark:px-2 dark:text-ui-heading [&_svg]:size-3.5';
const toISODate = (d: Date | null) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null;
const parseISODate = (s: string | null) => { if (!s) return null; const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };

interface TaskRow {
  id: string; title: string; status: 'todo' | 'in_progress' | 'done';
  assignee_id: string | null; assignee_name: string | null; due_date: string | null;
}

export function TaskList({ apiBasePath, assignees }: {
  apiBasePath: string;
  assignees: { id: string; full_name: string }[];
}) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newTask, setNewTask] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBasePath}/tasks`);
      const data = await res.json() as { tasks: TaskRow[] };
      setTasks(data.tasks ?? []);
    } catch { }
    finally { setLoaded(true); }
  }, [apiBasePath]);

  useEffect(() => { load(); }, [load]);

  async function addTask() {
    const title = newTask.trim();
    if (!title) return;
    setNewTask('');
    const res = await fetch(`${apiBasePath}/tasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }),
    }).catch(() => null);
    if (!res || !res.ok) { toast.error('Could not add task'); return; }
    const d = await res.json();
    setTasks(t => [...t, { ...d.task, assignee_name: null }]);
  }

  async function patchTask(task: TaskRow, patch: Partial<TaskRow>) {
    setTasks(ts => ts.map(t => (t.id === task.id ? { ...t, ...patch } : t)));
    const res = await fetch(`${apiBasePath}/tasks/${task.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    }).catch(() => null);
    if (!res || !res.ok) { toast.error('Could not save task'); load(); }
  }

  async function removeTask(task: TaskRow) {
    setTasks(ts => ts.filter(t => t.id !== task.id));
    await fetch(`${apiBasePath}/tasks/${task.id}`, { method: 'DELETE' }).catch(() => {});
  }

  const openCount = tasks.filter(t => t.status !== 'done').length;
  const assigneeOptions = [{ value: '', label: 'Unassigned' }, ...assignees.map(a => ({ value: a.id, label: a.full_name }))];

  return (
    <section aria-label="Subtasks" className={PANEL}>
      <div className={PANEL_HEAD}>
        <h3 className={PANEL_TITLE}>
          Subtasks{openCount > 0 && <span className="font-medium text-ui-text-secondary"> · {openCount} open</span>}
        </h3>
      </div>
      <div className="flex flex-col gap-3 p-4">
        {!loaded ? (
          <p className="m-0 inline-flex items-center gap-2 text-[13px] text-ui-text-secondary"><Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading…</p>
        ) : tasks.length === 0 ? (
          <p className="m-0 text-[13px] text-ui-text-secondary">No subtasks.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {tasks.map(t => {
              const done = t.status === 'done';
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-2 border-b border-ui-divider py-2 last:border-b-0">
                  <Checkbox checked={done} aria-label={done ? `Re-open ${t.title}` : `Mark ${t.title} done`}
                    onCheckedChange={() => patchTask(t, { status: done ? 'todo' : 'done' })} />
                  <span className={cn('min-w-0 flex-1 truncate text-[13px]', done ? 'text-ui-text-secondary line-through' : HEADING)}>{t.title}</span>
                  <Select aria-label={`Assignee for ${t.title}`} options={assigneeOptions} value={t.assignee_id ?? ''}
                    onValueChange={v => patchTask(t, { assignee_id: v || null })} className={cn(SMALL_FIELD, 'w-[150px]')} />
                  <DatePicker aria-label={`Due date for ${t.title}`} placeholder="Due date" iconEnd className={cn(SMALL_FIELD, 'w-[130px] justify-between')}
                    value={parseISODate(t.due_date)} onValueChange={d => patchTask(t, { due_date: toISODate(d) })} />
                  <Button variant="ghost" size="icon-sm" className="text-ui-text-secondary hover:text-error-normal" onClick={() => removeTask(t)} aria-label={`Delete ${t.title}`}>
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void addTask(); }}>
          <input aria-label="New subtask" placeholder="Add a subtask…" value={newTask} onChange={e => setNewTask(e.target.value)} className={FIELD} />
          <Button type="submit" variant="outline" size="md" className="shrink-0" disabled={!newTask.trim()}><Plus aria-hidden /> Add</Button>
        </form>
      </div>
    </section>
  );
}
