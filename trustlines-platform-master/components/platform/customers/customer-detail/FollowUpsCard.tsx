'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Select } from '@/components/platform/shared/Select';
import { todayISO, type Assignee, type FollowUp } from './types';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { AddButton, DetailCard, FORM_BOX, IconAction, RowList } from './ui';

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

  const openCount = followUps.filter(f => f.status === 'open').length;
  return (
    <DetailCard
      title={`Follow-ups (${openCount})`}
      action={canEdit && !addingFollowUp ? <AddButton label="Add Follow-up" onClick={() => setAddingFollowUp(true)} /> : undefined}
    >
      {addingFollowUp && canEdit && (
        <FollowUpForm assignees={assignees} onSave={save} onCancel={() => setAddingFollowUp(false)} />
      )}
      {followUps.length === 0 && !addingFollowUp ? (
        <EmptyState size="sm" icon={<CalendarDays />} title="No follow-ups yet." />
      ) : followUps.length > 0 && (
        <RowList>
          {followUps.map(f => {
            const done = f.status === 'done';
            const overdue = f.status === 'open' && f.due_date < todayISO();
            const who = nameOf(f.assignee_id);
            return (
              <div key={f.id} className={cn('flex items-center justify-between gap-3 py-2.5', f.status === 'cancelled' && 'opacity-60')}>
                <div className="flex min-w-0 items-center">
                  <span className="flex w-9 shrink-0 items-center px-2.5">
                    <input
                      type="checkbox" checked={done} disabled={!canEdit || f.status === 'cancelled'}
                      onChange={() => onSetStatus(f.id, done ? 'open' : 'done')}
                      aria-label={done ? `Reopen: ${f.note}` : `Mark done: ${f.note}`}
                      className="size-4 cursor-pointer rounded-[3px] accent-[var(--color-secondary-700)] disabled:cursor-default"
                    />
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5 pr-2.5">
                    <p className={cn('m-0 truncate text-[12px] font-medium text-ui-body', done && 'line-through text-ui-text-disabled')} title={f.note}>{f.note}</p>
                    <p className={cn('m-0 inline-flex items-center gap-1 text-[11px] leading-[1.4]', overdue ? 'text-error-normal' : 'text-ui-text-secondary')}>
                      <CalendarDays size={12} aria-hidden /> {formatDue(f.due_date)}{overdue ? ' · overdue' : ''}{who ? ` · ${who}` : ''}
                    </p>
                  </div>
                </div>
                {canEdit && <IconAction kind="delete" label="Remove follow-up" onClick={() => onDelete(f.id)} />}
              </div>
            );
          })}
        </RowList>
      )}
    </DetailCard>
  );
}

// Figma shows day/month/year (27/10/2026); the stored value is an ISO date.
function formatDue(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${Number(d)}/${Number(m)}/${y}` : iso;
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
    <div className={FORM_BOX}>
      <div className="mb-2.5 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_150px_180px]">
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
