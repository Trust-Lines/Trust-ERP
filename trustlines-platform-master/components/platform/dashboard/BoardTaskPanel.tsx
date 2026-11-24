'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { PersonFace } from '@/components/ui/avatar-directory';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Dashboard card popup (Figma 908:25017): "T Lines Tasks" and "Trust Lines Tasks" side by side — the
// to-dos agreed when the project is discussed in a meeting. Both are the dashboard's own tasks
// (trust_lines_tasks, migrations 153/154; /api/tlines-dashboard/trust-tasks/[anchor]/tasks?side=…),
// not the deal's sales tasks.
//
// Built for typing fast in a meeting: one always-open add row (title, assignee, Enter), rows edited
// in place (click the title; the assignee is a plain picker on the row), each row showing the day it
// was written; done tasks drop to the bottom behind "Show done". Assigning someone notifies them.

interface TaskRow {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  assignee_id: string | null;
  created_by?: string | null;
  assignee_name: string | null;
  due_date: string | null;
  created_at?: string;
}
type Patch = Partial<Pick<TaskRow, 'title' | 'status' | 'assignee_id'>>;

const HEADING = 'text-[var(--color-secondary-700)] dark:text-secondary-50';
// Done row (Figma 1025:11950): process/a0/w — mint fill with green ink in light, the reverse in dark.
const DONE_INK = 'text-[var(--process-a0w-fg)]';
const CHECKBOX = 'size-4 rounded-[3px] border-[var(--ui-input-border)] bg-ui-input-bg dark:border-[var(--ui-input-border)] dark:bg-ui-input-bg [&>span]:size-full [&>span]:rounded-[2px]';
const CHECKBOX_DONE = 'data-checked:border-[var(--process-a0w-fg)] dark:data-checked:border-[var(--process-a0w-fg)] [&>span]:bg-[var(--process-a0w-fg)] [&>span]:text-[var(--process-a0w-bg)] dark:[&>span]:bg-[var(--process-a0w-fg)] dark:[&>span]:text-[var(--process-a0w-bg)]';
const FIELD = 'h-8 rounded-[6px] border border-solid border-[var(--ui-input-border)] bg-ui-input-bg px-2 text-[13px] text-ui-body outline-none focus-visible:border-[var(--status-info-fg)]';
// Row pickers: borderless until hovered, so a row reads as text but edits in one click.
const ROW_PICK = 'h-7 rounded-[4px] border border-solid border-transparent bg-transparent px-1.5 text-[13px] hover:border-[var(--ui-input-border)] focus-visible:border-[var(--status-info-fg)]';

const initials = (name: string) => name.split(/[\s_]+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
/** In the order they were written. */
const byWritten = (a: TaskRow, b: TaskRow) => (a.created_at ?? '').localeCompare(b.created_at ?? '');
/** The day a task was written: "17 Nov 2026". */
const writtenOn = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export function BoardTaskPanel({ title, apiBasePath, query = '', assignees, canEdit, meId = null }: {
  title: string;
  /** The task list's route (GET/POST …/tasks, POST/DELETE …/tasks/[id]). */
  apiBasePath: string;
  /** Appended to every call, e.g. "?side=tlines". */
  query?: string;
  assignees: { id: string; full_name: string }[];
  /** Add for anyone, rename, assign and delete (the API checks it too). The task list's GET also
   *  says so (access: 'assign'); without it a person adds tasks for themselves only. */
  canEdit: boolean;
  /** The viewer: an assignee may tick their own task done. */
  meId?: string | null;
}) {
  const [tasks, setTasks] = React.useState<TaskRow[]>([]);
  const [access, setAccess] = React.useState<'assign' | 'self' | null>(null);
  const [state, setState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = React.useState<string | null>(null);
  const [showDone, setShowDone] = React.useState(false);
  const [editing, setEditing] = React.useState<string | null>(null);
  // The add row.
  const [draft, setDraft] = React.useState('');
  const [draftWho, setDraftWho] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const addRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    setState('loading');
    try {
      const res = await fetch(`${apiBasePath}/tasks${query}`);
      const body = await res.json().catch(() => ({})) as { tasks?: TaskRow[]; access?: 'assign' | 'self'; error?: string };
      if (!res.ok) throw new Error(res.status === 403 ? 'You don’t have access to these tasks.' : (body.error ?? 'Could not load tasks'));
      setTasks(body.tasks ?? []);
      setAccess(body.access ?? null);
      setState('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tasks');
      setState('error');
    }
  }, [apiBasePath, query]);
  React.useEffect(() => { void load(); }, [load]);

  // canEdit from the page, or the list's own answer (Roles: edit.board_tasks, Team: Coordinator).
  const canAssign = canEdit || access === 'assign';
  const ownTask = (t: TaskRow) => !!meId && t.created_by === meId && t.assignee_id === meId;

  const nameOf = React.useCallback((id: string | null) => (id ? assignees.find(a => a.id === id)?.full_name ?? null : null), [assignees]);
  const assigneeOptions = React.useMemo(
    () => [{ value: '', label: 'Unassigned' }, ...assignees.map(a => ({ value: a.id, label: a.full_name }))],
    [assignees],
  );

  async function addTask() {
    const text = draft.trim();
    if (!text || adding) return;
    setAdding(true);
    try {
      const res = await fetch(`${apiBasePath}/tasks${query}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: text, assignee_id: canAssign ? draftWho || null : meId }),
      });
      const body = await res.json().catch(() => null) as { task?: TaskRow; error?: string } | null;
      if (!res.ok || !body?.task) throw new Error(body?.error ?? 'Could not add the task');
      setTasks(ts => [...ts, { ...body.task!, assignee_name: nameOf(body.task!.assignee_id) }]);
      setDraft(''); setDraftWho('');
      addRef.current?.focus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add the task');
    } finally {
      setAdding(false);
    }
  }

  async function patchTask(task: TaskRow, patch: Patch) {
    const next = { ...task, ...patch, assignee_name: 'assignee_id' in patch ? nameOf(patch.assignee_id ?? null) : task.assignee_name };
    setTasks(ts => ts.map(t => (t.id === task.id ? next : t)));
    const res = await fetch(`${apiBasePath}/tasks/${task.id}${query}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    }).catch(() => null);
    if (!res || !res.ok) {
      const b = await res?.json().catch(() => null) as { error?: string } | null;
      toast.error(b?.error ?? 'Could not save the task');
      void load();
    }
  }

  async function removeTask(task: TaskRow) {
    if (!window.confirm(`Delete “${task.title}”?`)) return;
    setTasks(ts => ts.filter(t => t.id !== task.id));
    const res = await fetch(`${apiBasePath}/tasks/${task.id}${query}`, { method: 'DELETE' }).catch(() => null);
    if (!res || !res.ok) { toast.error('Could not delete the task'); void load(); }
  }

  const open = tasks.filter(t => t.status !== 'done').sort(byWritten);
  const done = tasks.filter(t => t.status === 'done');
  const shown = showDone ? [...open, ...done] : open;
  const ready = state === 'ready';

  return (
    <section aria-label={title} className="flex min-w-0 flex-1 flex-col gap-2.5 overflow-hidden rounded-[16px] border border-solid border-ui-divider bg-ui-surface-elevated px-3 pb-3 pt-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className={cn('m-0 truncate text-[20px] font-semibold leading-[1.35]', HEADING)}>{title}</h3>
          {ready && (
            <span className={cn('rounded-[4px] bg-ui-surface px-[9px] py-[3px] text-[15px] font-semibold leading-[1.4]', HEADING)} title="Open tasks">
              {open.length}
            </span>
          )}
        </div>
        {ready && done.length > 0 && (
          <button type="button" onClick={() => setShowDone(v => !v)} aria-pressed={showDone}
            className="rounded-[6px] px-2 py-1 text-[12px] font-medium text-ui-text-secondary hover:bg-ui-hover-bg hover:text-ui-heading">
            {showDone ? 'Hide done' : `Show done (${done.length})`}
          </button>
        )}
      </div>

      {/* Add row: always open — type, pick who, Enter. */}
      {ready && (canAssign || !!meId) && (
        <form className="flex flex-wrap items-center gap-2 px-1" onSubmit={e => { e.preventDefault(); void addTask(); }}>
          <input
            ref={addRef} value={draft} onChange={e => setDraft(e.target.value)} maxLength={500}
            placeholder={canAssign ? 'Add a task and press Enter…' : 'Add a task for yourself and press Enter…'} aria-label={`New ${title} item`}
            className={cn(FIELD, 'min-w-[180px] flex-1')}
          />
          {canAssign && (
            <Select aria-label="Assign the new task to" options={[{ value: '', label: 'Assign to…' }, ...assigneeOptions.slice(1)]}
              value={draftWho} onValueChange={v => setDraftWho(v ?? '')} className="h-8 w-[160px] text-[13px]" />
          )}
          <button type="submit" disabled={!draft.trim() || adding}
            className="flex h-8 shrink-0 items-center gap-1 rounded-[6px] bg-ui-btn-accent pl-2 pr-3 text-[13px] font-medium text-ui-btn-accent-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
            {adding ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Plus size={15} aria-hidden />} Add
          </button>
        </form>
      )}

      <div className="flex max-h-[260px] flex-col gap-1 overflow-y-auto">
        {state === 'loading' ? (
          <p className="m-0 flex items-center gap-2 px-2 py-2 text-[13px] text-ui-text-secondary"><Loader2 size={14} className="animate-spin" aria-hidden /> Loading…</p>
        ) : state === 'error' ? (
          <p className="m-0 px-2 py-2 text-[13px] font-medium" style={{ color: 'var(--status-t10-fg)' }}>{error}</p>
        ) : shown.length === 0 ? (
          <p className="m-0 px-2 py-2 text-[13px] text-ui-text-secondary">
            {done.length ? 'Everything is done.' : 'No tasks yet — add the first one above.'}
          </p>
        ) : shown.map(t => {
          const isDone = t.status === 'done';
          const rowEdit = canAssign || ownTask(t);
          const canTick = rowEdit || (!!meId && t.assignee_id === meId);
          return (
            <div key={t.id}
              className={cn('group flex min-h-10 items-center gap-2 rounded-[6px] pl-2 pr-1', isDone ? 'bg-[var(--process-a0w-bg)]' : 'bg-ui-surface')}>
              <Checkbox
                className={cn(CHECKBOX, 'shrink-0', isDone && CHECKBOX_DONE)}
                checked={isDone} disabled={!canTick}
                aria-label={isDone ? `Re-open ${t.title}` : `Mark ${t.title} done`}
                onCheckedChange={() => void patchTask(t, { status: isDone ? 'todo' : 'done' })}
              />
              <div className="min-w-0 flex-1">
                {editing === t.id ? (
                  <input
                    autoFocus defaultValue={t.title} maxLength={500} aria-label={`Rename ${t.title}`}
                    className={cn(FIELD, 'h-7 w-full')}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditing(null); }
                    }}
                    onBlur={e => {
                      const v = e.currentTarget.value.trim();
                      setEditing(null);
                      if (v && v !== t.title) void patchTask(t, { title: v });
                    }}
                  />
                ) : rowEdit ? (
                  <button type="button" onClick={() => setEditing(t.id)} title="Click to rename"
                    className={cn('block w-full truncate rounded-[4px] px-1 py-1 text-left text-[13px] font-medium leading-[1.4] hover:bg-ui-hover-bg',
                      isDone ? cn(DONE_INK, 'line-through') : HEADING)}>
                    {t.title}
                  </button>
                ) : (
                  <span className={cn('block truncate px-1 text-[13px] font-medium leading-[1.4]', isDone ? cn(DONE_INK, 'line-through') : HEADING)} title={t.title}>{t.title}</span>
                )}
              </div>

              {/* Assignee */}
              <div className="flex w-[170px] shrink-0 items-center gap-1.5">
                {t.assignee_name && (
                  <span className="flex size-[22px] shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-ui-page-bg text-[9px] font-semibold text-ui-body">
                    <PersonFace name={t.assignee_name} userId={t.assignee_id} fallback={initials(t.assignee_name)} />
                  </span>
                )}
                {canAssign ? (
                  <Select aria-label={`Assignee for ${t.title}`} options={assigneeOptions} value={t.assignee_id ?? ''}
                    onValueChange={v => void patchTask(t, { assignee_id: v || null })}
                    className={cn(ROW_PICK, 'w-auto min-w-0 flex-1 gap-1 [&_svg]:size-3.5', isDone ? DONE_INK : t.assignee_id ? HEADING : 'text-ui-text-secondary')} />
                ) : (
                  <span className={cn('truncate text-[13px]', isDone ? DONE_INK : t.assignee_name ? HEADING : 'text-ui-text-secondary')}>{t.assignee_name ?? 'Unassigned'}</span>
                )}
              </div>

              {/* The day it was written */}
              <span className={cn('w-[96px] shrink-0 text-right text-[13px] tabular-nums', isDone ? DONE_INK : HEADING)}
                title={t.created_at ? `Written ${new Date(t.created_at).toLocaleString('en-GB')}` : undefined}>
                {writtenOn(t.created_at)}
              </span>

              {rowEdit && (
                <button type="button" onClick={() => void removeTask(t)} aria-label={`Delete ${t.title}`} title="Delete"
                  className="flex size-7 shrink-0 items-center justify-center rounded-[4px] text-ui-text-secondary opacity-0 hover:bg-ui-hover-bg hover:text-[var(--status-t10-fg)] focus-visible:opacity-100 group-hover:opacity-100">
                  <Trash2 size={15} aria-hidden />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
