'use client';

import { useState } from 'react';
import { Trash2, Plus, CheckCircle2, Circle, CalendarClock } from 'lucide-react';
import { Select } from '@/components/platform/shared/Select';
import { todayISO, type Assignee, type FollowUp } from './types';
import { EmptyState } from '@/components/ui/empty-state';

export function FollowUpsCard({ followUps, assignees, canEdit, onSave, onSetStatus, onDelete }: {
  followUps: FollowUp[];
  assignees: Assignee[];
  canEdit?: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<boolean>;
  onSetStatus: (id: string, status: FollowUp['status']) => void;
  onDelete: (id: string) => void;
}) {
  const [addingFollowUp, setAddingFollowUp] = useState(false);
  const nameOf = (id: string | null) => (id ? assignees.find(a => a.id === id)?.full_name ?? 'Unknown' : null);

  async function save(payload: Record<string, unknown>): Promise<boolean> {
    const ok = await onSave(payload);
    if (ok) setAddingFollowUp(false);
    return ok;
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="form-section-title">Follow-ups ({followUps.filter(f => f.status === 'open').length} open)</div>
        {canEdit && !addingFollowUp && <button className="btn btn-ghost btn-sm" onClick={() => setAddingFollowUp(true)}><Plus size={13} /> Add follow-up</button>}
      </div>
      <div className="card-body">
        {addingFollowUp && canEdit && (
          <div style={{ marginBottom: 12 }}><FollowUpForm assignees={assignees} onSave={save} onCancel={() => setAddingFollowUp(false)} /></div>
        )}
        {followUps.length === 0 && !addingFollowUp ? (
          <EmptyState size="sm" icon={<CalendarClock />} title="No follow-ups yet." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {followUps.map(f => {
              const overdue = f.status === 'open' && f.due_date < todayISO();
              return (
                <div key={f.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 6, opacity: f.status === 'open' ? 1 : 0.6 }}>
                  {canEdit && (
                    <button className="btn btn-ghost btn-sm" style={{ padding: 2 }} aria-label={f.status === 'done' ? 'Reopen follow-up' : 'Mark done'}
                      onClick={() => onSetStatus(f.id, f.status === 'done' ? 'open' : 'done')}>
                      {f.status === 'done'
                        ? <CheckCircle2 size={16} style={{ color: 'var(--status-success-fg, #15803d)' }} />
                        : <Circle size={16} style={{ color: 'var(--fg-faint)' }} />}
                    </button>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, textDecoration: f.status === 'done' ? 'line-through' : 'none' }}>{f.note}</div>
                    <div style={{ fontSize: 12, color: overdue ? '#b91c1c' : 'var(--fg-subtle)', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <CalendarClock size={11} /> {f.due_date}{overdue ? ' · overdue' : ''}
                      {nameOf(f.assignee_id) && <span style={{ color: 'var(--fg-subtle)' }}> · {nameOf(f.assignee_id)}</span>}
                    </div>
                  </div>
                  {canEdit && <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px', color: '#dc2626' }} onClick={() => onDelete(f.id)} aria-label="Remove follow-up"><Trash2 size={13} /></button>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FollowUpForm({ assignees, onSave, onCancel }: {
  assignees: Assignee[]; onSave: (p: Record<string, unknown>) => Promise<boolean>; onCancel: () => void;
}) {
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState(todayISO());
  const [assigneeId, setAssigneeId] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!note.trim() || !dueDate) return;
    setSaving(true);
    await onSave({ note: note.trim(), due_date: dueDate, assignee_id: assigneeId || null });
    setSaving(false);
  }

  return (
    <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '12px 14px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 180px', gap: 8, marginBottom: 10 }}>
        <div><label className="form-label required" style={{ fontSize: 11 }}>Follow-up</label>
          <input className="form-input" style={{ fontSize: 13 }} placeholder="e.g. Call about layout approval" value={note} onChange={e => setNote(e.target.value)} autoFocus /></div>
        <div><label className="form-label required" style={{ fontSize: 11 }}>Due date</label>
          <input type="date" className="form-input" style={{ fontSize: 13 }} value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Assignee</label>
          <Select className="form-input" style={{ fontSize: 13 }} value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
            <option value="">— Unassigned</option>
            {assignees.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
          </Select></div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={!note.trim() || !dueDate || saving}>{saving ? 'Saving…' : 'Add follow-up'}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
