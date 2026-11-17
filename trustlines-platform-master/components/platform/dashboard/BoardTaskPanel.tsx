'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Check, Ellipsis, Loader2, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { PersonFace } from '@/components/ui/avatar-directory';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Figma "Page content" new version (908:25017): "T Lines Tasks" and "Trust Lines Tasks" side by side
// above the stage list. A panel lists its tasks as rows (checkbox, title, assignee, optional due date,
// row menu); "New Task" and "Rename" edit the title inline with ✓ / ✕. Done rows turn green.
//
// `apiBasePath` is an existing deal task route (/api/marketing/{opportunities|potentials}/[id]) —
// GET/POST …/tasks, POST/DELETE …/tasks/[taskId]. Without one the panel shows `unavailable` instead.

interface TaskRow {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  assignee_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
}

// Light / dark per Figma 908:25017 and 919:27984: text secondary-700 / secondary-50 (#EEF2F6).
const HEADING = 'text-[var(--color-secondary-700)] dark:text-secondary-50';
// Done rows: pale green with green ink in light, solid green with pale ink in dark (status-t6 flips).
const DONE_INK = 'text-[var(--status-t6-fg)]';
// Figma "Selection checkbox": 16px, 3px radius, input background + input border; when ticked it is
// filled with the row's ink and the tick takes the row's fill.
const CHECKBOX = 'size-4 rounded-[3px] border-[var(--ui-input-border)] bg-ui-input-bg dark:border-[var(--ui-input-border)] dark:bg-ui-input-bg [&>span]:size-full [&>span]:rounded-[2px]';
const CHECKBOX_DONE = 'data-checked:border-[var(--status-t6-fg)] dark:data-checked:border-[var(--status-t6-fg)] [&>span]:bg-[var(--status-t6-fg)] [&>span]:text-[var(--status-t6-bg)] dark:[&>span]:bg-[var(--status-t6-fg)] dark:[&>span]:text-[var(--status-t6-bg)]';
const ROW = 'flex min-h-9 items-center rounded-[6px] pr-2';
// Borderless assignee picker on the row being edited: just the name and a 14px chevron.
const ASSIGNEE_SELECT = 'h-7 w-auto max-w-[180px] gap-2 border-0 bg-transparent px-0 text-[13px] leading-[1.4] hover:border-0 dark:rounded-[4px] dark:border-0 dark:bg-transparent dark:px-0 [&_svg]:size-3.5';
const INLINE_EDITOR ='flex h-[23px] min-w-0 flex-1 items-center gap-1.5 rounded-[3px] border border-solid border-[var(--status-info-fg)] bg-ui-input-bg px-2';

const initials = (name: string) => name.split(/[\s_]+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

/** 17/6/2026 (Figma task date). */
function fmtDue(iso: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return y && m && d ? `${d}/${m}/${y}` : null;
}

function InlineTitle({ initial, label, onSave, onCancel }: {
  initial: string; label: string; onSave: (title: string) => void; onCancel: () => void;
}) {
  const [value, setValue] = React.useState(initial);
  const save = () => { const t = value.trim(); if (t) onSave(t); else onCancel(); };
  return (
    <div className={INLINE_EDITOR}>
      <input
        autoFocus
        aria-label={label}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); save(); }
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
        }}
        className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] leading-[1.4] text-ui-body outline-none"
      />
      <button type="button" onClick={save} aria-label="Save" className={cn('grid size-[14px] place-items-center', HEADING)}>
        <Check size={14} aria-hidden />
      </button>
      <button type="button" onClick={onCancel} aria-label="Cancel" className={cn('grid size-[14px] place-items-center', HEADING)}>
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

function Assignee({ name, userId, done }: { name: string | null; userId: string | null; done: boolean }) {
  if (!name) return <span className={cn('text-[13px] leading-[1.4]', done ? DONE_INK : 'text-ui-text-secondary')}>Unassigned</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex size-[22px] shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-ui-page-bg text-[9px] font-semibold text-ui-body">
        <PersonFace name={name} userId={userId} fallback={initials(name)} />
      </span>
      <span className={cn('truncate text-[13px] leading-[1.4]', done ? DONE_INK : HEADING)}>{name}</span>
    </span>
  );
}

export function BoardTaskPanel({ title, apiBasePath, assignees, canEdit, showDueDate = false, unavailable }: {
  title: string;
  /** Existing deal task route; null when this card has no deal (yet) or the list has no endpoint. */
  apiBasePath: string | null;
  assignees: { id: string; full_name: string }[];
  canEdit: boolean;
  showDueDate?: boolean;
  /** Shown when there is no `apiBasePath`. */
  unavailable: string;
}) {
  const [tasks, setTasks] = React.useState<TaskRow[]>([]);
  const [state, setState] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!apiBasePath) { setState('idle'); return; }
    setState('loading');
    try {
      const res = await fetch(`${apiBasePath}/tasks`);
      const body = await res.json().catch(() => ({})) as { tasks?: TaskRow[]; error?: string };
      if (!res.ok) throw new Error(res.status === 403 ? 'You don’t have access to these tasks.' : (body.error ?? 'Could not load tasks'));
      setTasks(body.tasks ?? []);
      setState('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tasks');
      setState('error');
    }
  }, [apiBasePath]);

  React.useEffect(() => { void load(); }, [load]);

  const writable = canEdit && !!apiBasePath && state === 'ready';

  async function addTask(text: string) {
    setAdding(false);
    const res = await fetch(`${apiBasePath}/tasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: text }),
    }).catch(() => null);
    if (!res || !res.ok) { toast.error('Could not add the task'); return; }
    const body = await res.json() as { task: TaskRow };
    setTasks(ts => [...ts, { ...body.task, assignee_name: null }]);
  }

  async function patchTask(task: TaskRow, patch: Partial<Pick<TaskRow, 'title' | 'status' | 'assignee_id'>>) {
    const assignee_name = 'assignee_id' in patch
      ? (assignees.find(a => a.id === patch.assignee_id)?.full_name ?? null)
      : task.assignee_name;
    setTasks(ts => ts.map(t => (t.id === task.id ? { ...t, ...patch, assignee_name } : t)));
    const res = await fetch(`${apiBasePath}/tasks/${task.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    }).catch(() => null);
    if (!res || !res.ok) { toast.error('Could not save the task'); void load(); }
  }

  async function removeTask(task: TaskRow) {
    setTasks(ts => ts.filter(t => t.id !== task.id));
    const res = await fetch(`${apiBasePath}/tasks/${task.id}`, { method: 'DELETE' }).catch(() => null);
    if (!res || !res.ok) { toast.error('Could not delete the task'); void load(); }
  }

  const assigneeOptions = React.useMemo(
    () => [{ value: '', label: 'Unassigned' }, ...assignees.map(a => ({ value: a.id, label: a.full_name }))],
    [assignees],
  );

  return (
    <section
      aria-label={title}
      className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden rounded-[16px] border border-solid border-ui-divider bg-ui-surface-elevated px-1 pb-5 pt-3"
    >
      <div className="flex items-center justify-between gap-3 pl-4 pr-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className={cn('m-0 truncate text-[20px] font-semibold leading-[1.35]', HEADING)}>{title}</h3>
          {state === 'ready' && (
            <span className={cn('rounded-[4px] bg-ui-surface px-[9px] py-[3px] text-[15px] font-semibold leading-[1.4]', HEADING)}>{tasks.length}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={!writable || adding}
          title={writable ? undefined : (apiBasePath ? undefined : 'Not connected yet')}
          className="flex shrink-0 items-center gap-1 rounded-[6px] bg-ui-btn-accent py-[5px] pl-[5px] pr-3 text-[13px] font-medium leading-[1.35] text-ui-btn-accent-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={16} aria-hidden /> New Task
        </button>
      </div>

      <div className="flex max-h-[184px] flex-col gap-1 overflow-y-auto px-2">
        {!apiBasePath ? (
          <p className="m-0 px-2 py-2 text-[13px] text-ui-text-secondary">{unavailable}</p>
        ) : state === 'loading' || state === 'idle' ? (
          <p className="m-0 flex items-center gap-2 px-2 py-2 text-[13px] text-ui-text-secondary"><Loader2 size={14} className="animate-spin" aria-hidden /> Loading…</p>
        ) : state === 'error' ? (
          <p className="m-0 px-2 py-2 text-[13px] font-medium" style={{ color: 'var(--status-t10-fg)' }}>{error}</p>
        ) : (
          <>
            {adding && (
              <div className={cn(ROW, 'bg-ui-selected-bg')}>
                <span className="flex h-9 w-12 shrink-0 items-center justify-center"><Checkbox disabled aria-label="New task" className={CHECKBOX} /></span>
                <InlineTitle initial="" label="New task title" onSave={t => void addTask(t)} onCancel={() => setAdding(false)} />
              </div>
            )}
            {tasks.length === 0 && !adding && (
              <p className="m-0 px-2 py-2 text-[13px] text-ui-text-secondary">No tasks yet.</p>
            )}
            {tasks.map(t => {
              const done = t.status === 'done';
              const isEditing = editing === t.id;
              return (
                <div
                  key={t.id}
                  className={cn(ROW, isEditing ? 'bg-ui-selected-bg' : done ? 'bg-[var(--status-t6-bg)]' : 'bg-ui-surface')}
                >
                  <span className="flex h-9 w-12 shrink-0 items-center justify-center">
                    <Checkbox
                      className={cn(CHECKBOX, done && CHECKBOX_DONE)}
                      checked={done}
                      disabled={!writable}
                      aria-label={done ? `Re-open ${t.title}` : `Mark ${t.title} done`}
                      onCheckedChange={() => void patchTask(t, { status: done ? 'todo' : 'done' })}
                    />
                  </span>
                  <div className="flex min-w-0 flex-1 items-center pr-4">
                    {isEditing ? (
                      <InlineTitle
                        initial={t.title}
                        label={`Rename ${t.title}`}
                        onSave={title => { setEditing(null); if (title !== t.title) void patchTask(t, { title }); }}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <span className={cn('truncate text-[13px] font-medium leading-[1.4]', done ? cn(DONE_INK, 'line-through decoration-2') : HEADING)} title={t.title}>
                        {t.title}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-8">
                    {isEditing && writable ? (
                      // Figma 908:25017 / 919:27917: avatar + name + chevron, no field box.
                      <span className="flex min-w-0 items-center gap-2">
                        {t.assignee_name && (
                          <span className="flex size-[22px] shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-ui-page-bg text-[9px] font-semibold text-ui-body">
                            <PersonFace name={t.assignee_name} userId={t.assignee_id} fallback={initials(t.assignee_name)} />
                          </span>
                        )}
                        <Select
                          aria-label={`Assignee for ${t.title}`}
                          options={assigneeOptions}
                          value={t.assignee_id ?? ''}
                          onValueChange={v => void patchTask(t, { assignee_id: v || null })}
                          className={cn(ASSIGNEE_SELECT, HEADING)}
                        />
                      </span>
                    ) : (
                      <Assignee name={t.assignee_name} userId={t.assignee_id} done={done} />
                    )}
                    {showDueDate && (
                      <span className={cn('w-[72px] text-[13px] leading-[1.4]', done ? DONE_INK : HEADING)}>{fmtDue(t.due_date) ?? '—'}</span>
                    )}
                    <span className="flex w-12 justify-center">
                      <Menu>
                        <MenuTrigger render={<Button variant="ghost" size="icon-sm" disabled={!writable} aria-label={`Actions for ${t.title}`} />}>
                          <Ellipsis />
                        </MenuTrigger>
                        <MenuContent>
                          <MenuItem onClick={() => setEditing(t.id)}><Pencil aria-hidden /> Rename or assign</MenuItem>
                          <MenuItem onClick={() => void patchTask(t, { status: done ? 'todo' : 'done' })}>
                            {done ? <><RotateCcw aria-hidden /> Re-open</> : <><Check aria-hidden /> Mark done</>}
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem onClick={() => void removeTask(t)} className="text-[var(--status-t10-fg)]"><Trash2 aria-hidden /> Delete</MenuItem>
                        </MenuContent>
                      </Menu>
                    </span>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
}
