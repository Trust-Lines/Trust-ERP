'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Check, Loader2 } from 'lucide-react';

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

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="text-eyebrow">Tasks</div>
          <div className="form-section-title">
            Subtasks{openCount > 0 && <span style={{ color: 'var(--fg-muted)', fontWeight: 500 }}> · {openCount} open</span>}
          </div>
        </div>
      </div>
      <div className="card-body">
        {!loaded ? (
          <div style={{ color: 'var(--fg-subtle)', fontSize: 13 }}><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {tasks.length === 0 && <div style={{ fontSize: 13, color: 'var(--fg-faint)' }}>No subtasks.</div>}
            {tasks.map(t => {
              const done = t.status === 'done';
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    onClick={() => patchTask(t, { status: done ? 'todo' : 'done' })}
                    title={done ? 'Re-open' : 'Mark done'}
                    style={{
                      width: 17, height: 17, borderRadius: 4, cursor: 'pointer', flexShrink: 0,
                      border: `1.5px solid ${done ? 'var(--brand-teal)' : 'var(--border-default)'}`,
                      background: done ? 'var(--brand-teal)' : 'transparent',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >{done && <Check size={11} strokeWidth={3} color="white" />}</div>
                  <span style={{ flex: 1, fontSize: 13, color: done ? 'var(--fg-faint)' : 'var(--fg-default)', textDecoration: done ? 'line-through' : 'none' }}>
                    {t.title}
                  </span>
                  <select value={t.assignee_id ?? ''} onChange={e => patchTask(t, { assignee_id: e.target.value || null })}
                    style={{ fontSize: 12, padding: '3px 6px', border: '1px solid var(--border-subtle)', borderRadius: 6, background: 'var(--bg-surface)', maxWidth: 130 }}>
                    <option value="">Unassigned</option>
                    {assignees.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                  </select>
                  <input type="date" value={t.due_date ?? ''} onChange={e => patchTask(t, { due_date: e.target.value || null })}
                    style={{ fontSize: 12, padding: '3px 6px', border: '1px solid var(--border-subtle)', borderRadius: 6, background: 'var(--bg-surface)' }} />
                  <button onClick={() => removeTask(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-faint)', padding: 2 }} aria-label="Delete task">
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-input" placeholder="Add a subtask…" value={newTask}
            onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }} style={{ fontSize: 13 }} />
          <button className="btn btn-secondary btn-sm" onClick={addTask} disabled={!newTask.trim()}><Plus size={13} /> Add</button>
        </div>
      </div>
    </div>
  );
}
