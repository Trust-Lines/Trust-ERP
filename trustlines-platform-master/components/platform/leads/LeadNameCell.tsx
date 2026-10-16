'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Clock, ListChecks } from 'lucide-react';
import { readableTextColor } from '@/lib/marketing/pillColor';
import type { Lead } from './types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

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
            <Button variant="ghost" size="icon-xs" onClick={() => setExpanded(s => !s)} aria-expanded={expanded} aria-label={expanded ? 'Hide subtasks' : 'Show subtasks'} className="size-[13px]">
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </Button>
          ) : <span style={{ width: 13, flexShrink: 0 }} />}

          <button type="button" onClick={onOpen} className="min-w-0 flex-1 rounded-[2px] text-left outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring">
            <span style={{ fontWeight: 600, color: 'var(--brand-teal-600)', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
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
            </span>
            <span style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', overflow: 'hidden' }}>
              <span>{lead.project_no ?? 'Open →'}</span>
              {taskCount > 0 && (
                <span title={`${doneCount} of ${taskCount} subtasks done`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700, color: doneCount === taskCount ? 'var(--brand-teal-600)' : 'var(--status-warning-fg)' }}>
                  <ListChecks size={11} /> {doneCount}/{taskCount}
                </span>
              )}
            </span>
          </button>

          {/* Shown on hover, and whenever one of them has keyboard focus. */}
          <div className={cn('flex shrink-0 gap-0.5 transition-opacity', hovered ? 'opacity-100' : 'opacity-0 focus-within:opacity-100')}>
            <Button variant="ghost" size="icon-xs" onClick={() => { setAdding(true); setExpanded(true); }} title="Add subtask" aria-label="Add subtask"><Plus size={13} /></Button>
            <Button variant="ghost" size="icon-xs" onClick={onEdit} title="Edit" aria-label="Edit"><Pencil size={12} /></Button>
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
                <Checkbox
                  checked={done}
                  onCheckedChange={() => patchTask(t, { status: done ? 'todo' : 'done' })}
                  title={done ? 'Re-open' : 'Mark done'}
                  aria-label={`${done ? 'Re-open' : 'Mark done'}: ${t.title}`}
                />
                <span style={{ flex: 1, fontSize: 12, color: done ? 'var(--fg-faint)' : 'var(--fg-default)', textDecoration: done ? 'line-through' : 'none' }}>
                  {t.title}
                </span>
                <div onClick={e => e.stopPropagation()}>
                  <Select
                    aria-label={`Assignee for ${t.title}`}
                    className="h-6 w-auto max-w-[110px] border-transparent bg-transparent text-primary-400 hover:border-ui-divider"
                    value={t.assignee_id ?? ''}
                    onValueChange={v => patchTask(t, { assignee_id: v || null })}
                    options={[{ value: '', label: 'Unassigned' }, ...assignees.map(a => ({ value: a.id, label: a.full_name }))]}
                  />
                </div>
                <Button variant="ghost" size="icon-xs" onClick={() => removeTask(t)} aria-label={`Delete subtask: ${t.title}`}>
                  <Trash2 size={11} />
                </Button>
              </div>
            );
          })}

          {adding ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ width: 14 }} />
              <Input
                autoFocus aria-label="New subtask name" placeholder="Subtask name…" value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveNewSubtask(); if (e.key === 'Escape') { setAdding(false); setDraft(''); } }}
                onBlur={() => saveNewSubtask()}
                className="h-7 max-w-[220px] flex-1"
              />
            </div>
          ) : (
            <Button variant="ghost" size="xs" className="w-fit text-primary-400" onClick={() => setAdding(true)}>
              <Plus size={12} /> Add subtask
            </Button>
          )}
        </div>
      )}
    </>
  );
}
