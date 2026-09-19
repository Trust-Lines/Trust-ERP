'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Check, RefreshCw } from 'lucide-react';
import { Avatar } from '@/components/platform/shared/Avatar';
import { formatDate } from '@/lib/formatDate';
import { Select } from '@/components/platform/shared/Select';
import { OpportunityQuickView } from '@/components/platform/marketing/OpportunityQuickView';

export interface TaskRow {
  id: string;
  /** 'lead' = old lead-intake task, 'opportunity' = a pipeline deal (incl. the auto follow-ups). */
  kind: 'lead' | 'opportunity';
  /** Id of the lead intake or the Opportunity the task belongs to. */
  lead_id: string;
  /** Pipeline stage label, for Opportunity tasks. */
  deal_stage: string | null;
  /** The deal's CRM "Date created" — what the CRM board sorts by. */
  deal_date: string | null;
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
// Deal date is written exactly like the CRM board's "Date created" (m/d/yy) so the two screens read the same.
const fmtCrm = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
};

const taskApi = (t: TaskRow) =>
  t.kind === 'opportunity'
    ? `/api/marketing/opportunities/${t.lead_id}/tasks/${t.id}`
    : `/api/leads/${t.lead_id}/tasks/${t.id}`;
const taskHref = (t: TaskRow) => (t.kind === 'opportunity' ? `/leads?open=${t.lead_id}` : `/leads/${t.lead_id}`);

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
  const [fOverdue, setFOverdue] = useState(false);
  const [openDealId, setOpenDealId] = useState<string | null>(null); // deal shown in the progress pop-up
  const [syncing, setSyncing] = useState(false);
  useEffect(() => { setTasks(initial); }, [initial]);

  // Bring the list up to date with the pipeline: every open deal gets the follow-ups its stage calls
  // for (proposal sent -> "what was their answer?", waiting -> "check in", ...). Idempotent.
  async function syncFromPipeline(silent: boolean) {
    setSyncing(true);
    const res = await fetch('/api/sales/tasks/sync', { method: 'POST' }).catch(() => null);
    setSyncing(false);
    if (!res || !res.ok) { if (!silent) toast.error('Could not update tasks from the pipeline'); return; }
    const r = await res.json() as { created: number; retired: number };
    if (r.created || r.retired) { toast.success(`${r.created} new task${r.created === 1 ? '' : 's'} from the pipeline${r.retired ? ` · ${r.retired} no longer needed` : ''}`); router.refresh(); }
    else if (!silent) toast.success('Tasks are up to date');
  }
  const syncedOnce = useRef(false);
  useEffect(() => { if (syncedOnce.current) return; syncedOnce.current = true; void syncFromPipeline(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const today = new Date().toISOString().slice(0, 10);

  async function patch(t: TaskRow, body: Partial<TaskRow>) {
    setBusy(t.id);
    setTasks(ts => ts.map(x => (x.id === t.id ? { ...x, ...body } : x)));
    const res = await fetch(taskApi(t), {
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
      if (fOverdue && !(t.status !== 'done' && t.due_date && t.due_date < today)) return false;
      if (q && !`${t.title} ${t.lead_name} ${t.deal_stage ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => {
      // Same order as the CRM board: newest deal first — never the oldest project on top.
      const ta = Date.parse(a.deal_date ?? '') || 0, tb = Date.parse(b.deal_date ?? '') || 0;
      if (ta !== tb) return tb - ta;
      if (a.lead_id !== b.lead_id) return a.lead_id.localeCompare(b.lead_id);   // keep one deal's tasks together
      const ad = a.status === 'done' ? 1 : 0, bd = b.status === 'done' ? 1 : 0;
      if (ad !== bd) return ad - bd;                                             // within a deal: open first
      return (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999');
    });
  }, [tasks, mine, fStatus, fAssignee, fOverdue, search, currentUserId, today]);

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
        <Select className="form-input form-select" value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ width: 160, fontSize: 13 }}>
          <option value="">All statuses</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </Select>
        <Select className="form-input form-select" value={fAssignee} onChange={e => setFAssignee(e.target.value)} style={{ width: 180, fontSize: 13 }}>
          <option value="">All assignees</option>
          <option value="__none__">Unassigned</option>
          {assignees.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </Select>
        <button
          onClick={() => setFOverdue(o => !o)}
          style={{
            padding: '7px 12px', fontSize: 12.5, fontWeight: 600, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            border: `1px solid ${fOverdue ? 'var(--status-danger)' : 'var(--border-default)'}`,
            background: fOverdue ? 'var(--status-danger)' : 'var(--bg-surface)', color: fOverdue ? '#fff' : 'var(--fg-muted)',
          }}
        >
          Overdue{overdue > 0 ? ` · ${overdue}` : ''}
        </button>
        {(mine || fStatus || fAssignee || fOverdue || search) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setMine(false); setFStatus(''); setFAssignee(''); setFOverdue(false); setSearch(''); }}>Clear</button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => syncFromPipeline(false)} disabled={syncing} title="Create the follow-ups each open deal needs">
          <RefreshCw size={13} className={syncing ? 'spin' : undefined} /> {syncing ? 'Updating…' : 'Update from pipeline'}
        </button>
        <span style={{ fontSize: 12, color: 'var(--fg-faint)', marginLeft: 'auto' }}>{visible.length} shown</span>
      </div>

      <div className="card">
        <div className="card-body flush">
          {visible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-subtle)' }}>No tasks. Open deals get their follow-ups automatically — use “Update from pipeline” if you expect some.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 34 }}></th>
                  <th style={{ minWidth: 380 }}>Task</th>
                  <th style={{ minWidth: 240 }}>Deal / Lead</th>
                  <th>Deal date</th>
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
                        {t.kind === 'opportunity' ? (
                          <button
                            onClick={() => setOpenDealId(t.lead_id)}
                            title="See how this deal has progressed"
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: 'var(--brand-teal-600)', textAlign: 'left' }}
                          >{t.lead_name}</button>
                        ) : (
                          <Link href={taskHref(t)} style={{ fontSize: 13, color: 'var(--brand-teal-600)', textDecoration: 'none' }}>{t.lead_name}</Link>
                        )}
                        {t.deal_stage && (
                          <div style={{ marginTop: 2 }}>
                            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 8px', borderRadius: 999, background: 'var(--bg-sunken)', color: 'var(--fg-muted)' }}>{t.deal_stage}</span>
                          </div>
                        )}
                      </td>
                      <td><span style={{ fontSize: 12.5, color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>{fmtCrm(t.deal_date)}</span></td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {t.assignee_name && <Avatar name={t.assignee_name} size="sm" />}
                          <Select
                            value={t.assignee_id ?? ''}
                            onChange={e => {
                              const id = e.target.value || null;
                              patch(t, { assignee_id: id, assignee_name: assignees.find(a => a.id === id)?.full_name ?? null });
                            }}
                            style={{ fontSize: 12, padding: '3px 6px', border: '1px solid var(--border-subtle)', borderRadius: 6, background: 'var(--bg-surface)', maxWidth: 150 }}
                          >
                            <option value="">Unassigned</option>
                            {assignees.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                          </Select>
                        </span>
                      </td>
                      <td>
                        <Select
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
                        </Select>
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

      {openDealId && (
        <OpportunityQuickView
          opportunityId={openDealId}
          assignees={assignees}
          onClose={() => { setOpenDealId(null); router.refresh(); }}
        />
      )}
    </>
  );
}
