'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { Avatar } from '@/components/platform/shared/Avatar';
import { formatDate } from '@/lib/formatDate';

export interface TaskRow {
  id: string;
  lead_id: string;
  lead_name: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  assignee_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
}

const STATUS_META: Record<TaskRow['status'], { label: string; bg: string; fg: string }> = {
  todo:        { label: 'To Do',       bg: 'var(--status-info-bg)',    fg: 'var(--status-info-fg)' },
  in_progress: { label: 'In Progress', bg: 'var(--status-warning-bg)', fg: 'var(--status-warning-fg)' },
  done:        { label: 'Done',        bg: 'var(--status-success-bg)', fg: 'var(--status-success-fg)' },
};

const fmt = (iso: string | null) => formatDate(iso);

export function TasksClient({ tasks: initial, assignees, currentUserId }: {
  tasks: TaskRow[];
  assignees: { id: string; full_name: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  const [mine, setMine]     = useState(false);
  const [fStatus, setFStatus] = useState('');
  const [fAssignee, setFAssignee] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  async function patch(t: TaskRow, body: Partial<TaskRow>) {
    setBusy(t.id);
    setTasks(ts => ts.map(x => (x.id === t.id ? { ...x, ...body } : x)));
    const res = await fetch(`/api/leads/${t.lead_id}/tasks/${t.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => null);
    if (!res || !res.ok) { toast.error('Could not save'); router.refresh(); }
    setBusy(null);
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter(t => {
      if (mine && t.assignee_id !== currentUserId) return false;
      if (fStatus && t.status !== fStatus) return false;
      if (fAssignee === '__none__' && t.assignee_id) return false;
      if (fAssignee && fAssignee !== '__none__' && t.assignee_id !== fAssignee) return false;
      if (q && !`${t.title} ${t.lead_name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, mine, fStatus, fAssignee, search, currentUserId]);

  const open = tasks.filter(t => t.status !== 'done').length;
  const overdue = tasks.filter(t => t.status !== 'done' && t.due_date && t.due_date < today).length;
  const myOpen = tasks.filter(t => t.status !== 'done' && t.assignee_id === currentUserId).length;

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: '0 0 4px' }}>Tasks</h1>
        <p className="page-head-sub" style={{ margin: 0 }}>
          {open} open · {myOpen} assigned to me
          {overdue > 0 && <> · <b style={{ color: 'var(--status-danger)' }}>{overdue} overdue</b></>}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <button
          onClick={() => setMine(m => !m)}
          style={{
            padding: '7px 12px', fontSize: 12.5, fontWeight: 600, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            border: `1px solid ${mine ? 'var(--brand-teal)' : 'var(--border-default)'}`,
            background: mine ? 'var(--brand-teal)' : 'var(--bg-surface)', color: mine ? '#fff' : 'var(--fg-muted)',
          }}
        >
          Assigned to me{myOpen > 0 ? ` · ${myOpen}` : ''}
        </button>
        <input className="form-input" placeholder="Search task or lead…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 260, fontSize: 13 }} />
        <select className="form-input form-select" value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ width: 160, fontSize: 13 }}>
          <option value="">All statuses</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        <select className="form-input form-select" value={fAssignee} onChange={e => setFAssignee(e.target.value)} style={{ width: 180, fontSize: 13 }}>
          <option value="">All assignees</option>
          <option value="__none__">Unassigned</option>
          {assignees.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
        {(mine || fStatus || fAssignee || search) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setMine(false); setFStatus(''); setFAssignee(''); setSearch(''); }}>Clear</button>
        )}
        <span style={{ fontSize: 12, color: 'var(--fg-faint)', marginLeft: 'auto' }}>{visible.length} shown</span>
      </div>

      <div className="card">
        <div className="card-body flush">
          {visible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>No tasks.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 34 }}></th>
                  <th>Task</th>
                  <th>Lead</th>
                  <th>Assignee</th>
                  <th>Status</th>
                  <th>Due</th>
                  <th>Created</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(t => {
                  const done = t.status === 'done';
                  const isOverdue = !done && t.due_date && t.due_date < today;
                  return (
                    <tr key={t.id} style={{ opacity: busy === t.id ? 0.6 : 1 }}>
                      <td>
                        <div
                          onClick={() => patch(t, { status: done ? 'todo' : 'done', completed_at: done ? null : new Date().toISOString() })}
                          title={done ? 'Re-open' : 'Mark done'}
                          style={{
                            width: 17, height: 17, borderRadius: 4, cursor: 'pointer',
                            border: `1.5px solid ${done ? 'var(--brand-teal)' : 'var(--border-default)'}`,
                            background: done ? 'var(--brand-teal)' : 'transparent',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >{done && <Check size={11} strokeWidth={3} color="#fff" />}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: 13, fontWeight: 500, color: done ? 'var(--fg-faint)' : 'var(--fg-default)', textDecoration: done ? 'line-through' : 'none' }}>
                          {t.title}
                        </span>
                      </td>
                      <td>
                        <Link href={`/leads/${t.lead_id}`} style={{ fontSize: 13, color: 'var(--brand-teal-600)', textDecoration: 'none' }}>{t.lead_name}</Link>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {t.assignee_name && <Avatar name={t.assignee_name} size="sm" />}
                          <select
                            value={t.assignee_id ?? ''}
                            onChange={e => {
                              const id = e.target.value || null;
                              patch(t, { assignee_id: id, assignee_name: assignees.find(a => a.id === id)?.full_name ?? null });
                            }}
                            style={{ fontSize: 12, padding: '3px 6px', border: '1px solid var(--border-subtle)', borderRadius: 6, background: 'var(--bg-surface)', maxWidth: 150 }}
                          >
                            <option value="">Unassigned</option>
                            {assignees.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                          </select>
                        </span>
                      </td>
                      <td>
                        <select
                          value={t.status}
                          onChange={e => {
                            const s = e.target.value as TaskRow['status'];
                            patch(t, { status: s, completed_at: s === 'done' ? new Date().toISOString() : null });
                          }}
                          style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--radius-pill)', border: 'none', background: STATUS_META[t.status].bg, color: STATUS_META[t.status].fg }}
                        >
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="done">Done</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="date" value={t.due_date ?? ''}
                          onChange={e => patch(t, { due_date: e.target.value || null })}
                          style={{ fontSize: 12, padding: '3px 6px', border: '1px solid var(--border-subtle)', borderRadius: 6, background: 'var(--bg-surface)', color: isOverdue ? 'var(--status-danger)' : 'var(--fg-default)' }}
                        />
                      </td>
                      <td><span style={{ fontSize: 12.5, color: 'var(--fg-subtle)' }}>{fmt(t.created_at)}</span></td>
                      <td><span style={{ fontSize: 12.5, color: done ? 'var(--brand-teal-600)' : 'var(--fg-faint)' }}>{fmt(t.completed_at)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
