'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Plus, Pencil, Check, Trash2, Clock, ListChecks } from 'lucide-react';
import { readableTextColor } from '@/lib/marketing/pillColor';
import type { Lead } from './types';

interface TaskRow {
  id: string; title: string; status: 'todo' | 'in_progress' | 'done';
  assignee_id: string | null; assignee_name: string | null; due_date: string | null;
}

function apiBasePathFor(lead: Lead): string {
  if (lead.origin === 'opportunity') return `/api/marketing/opportunities/${lead.id}`;
  if (lead.origin === 'potential') return `/api/marketing/potentials/${lead.id}`;
  return `/api/leads/${lead.id}`;
}

export function LeadNameCell({ lead, today, assignees, onOpen, onEdit }: {
  lead: Lead;
  today: string;
  assignees: { id: string; full_name: string }[];
  onOpen: () => void;
  onEdit: () => void;
}) {
  const apiBase = apiBasePathFor(lead);
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const res = await fetch(`${apiBase}/tasks`);
      const body = await res.json().catch(() => ({}));
      setTasks(body.tasks ?? []);
    } catch { setTasks([]); }
    finally { setLoadingTasks(false); }
  }, [apiBase]);

  useEffect(() => { if (expanded && tasks === null) loadTasks(); }, [expanded, tasks, loadTasks]);

  async function saveNewSubtask() {
    const title = draft.trim();
    if (!title) { setAdding(false); return; }
    setDraft('');
    setAdding(false);
    const res = await fetch(`${apiBase}/tasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }),
    }).catch(() => null);
    if (!res || !res.ok) return;
    const body = await res.json();
    setTasks(prev => [...(prev ?? []), body.task]);
    setExpanded(true);
  }

  async function patchTask(task: TaskRow, patch: Partial<TaskRow>) {
    setTasks(prev => (prev ?? []).map(t => (t.id === task.id ? { ...t, ...patch } : t)));
    await fetch(`${apiBase}/tasks/${task.id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    }).catch(() => {});
  }

  async function removeTask(task: TaskRow) {
    setTasks(prev => (prev ?? []).filter(t => t.id !== task.id));
    await fetch(`${apiBase}/tasks/${task.id}`, { method: 'DELETE' }).catch(() => {});
  }

  const taskCount = tasks?.length ?? lead.tasks_total ?? 0;
  const doneCount = tasks ? tasks.filter(t => t.status === 'done').length : (lead.tasks_done ?? 0);

  return (
    <>
      <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {(taskCount > 0 || expanded) ? (
            <button onClick={() => setExpanded(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-faint)', padding: 0, display: 'flex', flexShrink: 0 }}>
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          ) : <span style={{ width: 13, flexShrink: 0 }} />}

          <div onClick={onOpen} style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--brand-teal-600)', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{lead.name}</span>
              {(lead.tag_pills ?? []).map(t => (
                <span key={t.name} style={{ flexShrink: 0, fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 4, background: t.color || 'var(--bg-subtle)', color: readableTextColor(t.color || '#888888') }}>
                  {t.name}
                </span>
              ))}
              {(() => {
                if (!lead.follow_up_date) return null;
                const overdue = lead.follow_up_date < today;
                const dueToday = lead.follow_up_date === today;
                if (!overdue && !dueToday) return null;
                return (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 'var(--radius-pill)',
                    fontSize: 10, fontWeight: 700, flexShrink: 0,
                    background: overdue ? 'var(--status-danger-bg)' : 'var(--status-warning-bg)', color: overdue ? 'var(--status-danger)' : 'var(--status-warning)',
                  }}>
                    <Clock size={9} /> {overdue ? 'Overdue' : 'Due today'}
                  </span>
                );
              })()}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', overflow: 'hidden' }}>
              <span>{lead.project_no ?? 'Open →'}</span>
              {taskCount > 0 && (
                <span title={`${doneCount} of ${taskCount} subtasks done`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700, color: doneCount === taskCount ? 'var(--brand-teal-600)' : 'var(--status-warning-fg)' }}>
                  <ListChecks size={11} /> {doneCount}/{taskCount}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 2, opacity: hovered ? 1 : 0, transition: 'opacity 100ms', flexShrink: 0 }}>
            <button onClick={() => { setAdding(true); setExpanded(true); }} title="Add subtask" style={iconBtn}><Plus size={13} /></button>
            <button onClick={onEdit} title="Edit" style={iconBtn}><Pencil size={12} /></button>
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ paddingLeft: 19, marginTop: 2, display: 'grid', gap: 2 }}>
          {loadingTasks && <div style={{ fontSize: 11.5, color: 'var(--fg-faint)' }}>Loading…</div>}
          {(tasks ?? []).map(t => {
            const done = t.status === 'done';
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 7, height: 26 }}>
                <div
                  onClick={() => patchTask(t, { status: done ? 'todo' : 'done' })}
                  title={done ? 'Re-open' : 'Mark done'}
                  style={{
                    width: 13, height: 13, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
                    border: `1.5px ${done ? 'solid' : 'dashed'} ${done ? 'var(--brand-teal)' : 'var(--fg-faint)'}`,
                    background: done ? 'var(--brand-teal)' : 'transparent',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >{done && <Check size={8} strokeWidth={3} color="white" />}</div>
                <span style={{ flex: 1, fontSize: 12, color: done ? 'var(--fg-faint)' : 'var(--fg-default)', textDecoration: done ? 'line-through' : 'none' }}>
                  {t.title}
                </span>
                <select
                  value={t.assignee_id ?? ''} onClick={e => e.stopPropagation()}
                  onChange={e => patchTask(t, { assignee_id: e.target.value || null })}
                  style={{ fontSize: 11, padding: '2px 5px', border: '1px solid transparent', borderRadius: 5, background: 'transparent', maxWidth: 110, color: 'var(--fg-faint)' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <option value="">Unassigned</option>
                  {assignees.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                </select>
                <button onClick={() => removeTask(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-faint)', padding: 0, display: 'flex' }} aria-label="Delete subtask">
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}

          {adding ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ width: 14 }} />
              <input
                autoFocus className="form-input" placeholder="Subtask name…" value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveNewSubtask(); if (e.key === 'Escape') { setAdding(false); setDraft(''); } }}
                onBlur={() => saveNewSubtask()}
                style={{ fontSize: 12, padding: '3px 8px', flex: 1, maxWidth: 220 }}
              />
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-faint)', fontSize: 11.5, padding: '2px 0', width: 'fit-content' }}
            >
              <Plus size={12} /> Add subtask
            </button>
          )}
        </div>
      )}
    </>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-faint)',
  padding: 3, display: 'flex', borderRadius: 4,
};
