'use client';

import { useState } from 'react';
import { Trash2, Plus, CalendarDays } from 'lucide-react';
import { Select } from '@/components/platform/shared/Select';
import { MEETING_TYPES, cap, type Meeting } from './types';
import { EmptyState } from '@/components/ui/empty-state';

export function MeetingsCard({ meetings, canEdit, onSave, onSetStatus, onDelete }: {
  meetings: Meeting[];
  canEdit?: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<boolean>;
  onSetStatus: (id: string, status: Meeting['status']) => void;
  onDelete: (id: string) => void;
}) {
  const [addingMeeting, setAddingMeeting] = useState(false);

  async function save(payload: Record<string, unknown>): Promise<boolean> {
    const ok = await onSave(payload);
    if (ok) setAddingMeeting(false);
    return ok;
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="form-section-title">Meetings ({meetings.length})</div>
        {canEdit && !addingMeeting && <button className="btn btn-ghost btn-sm" onClick={() => setAddingMeeting(true)}><Plus size={13} /> Add meeting</button>}
      </div>
      <div className="card-body">
        {addingMeeting && canEdit && (
          <div style={{ marginBottom: 12 }}><MeetingForm onSave={save} onCancel={() => setAddingMeeting(false)} /></div>
        )}
        {meetings.length === 0 && !addingMeeting ? (
          <EmptyState size="sm" icon={<CalendarDays />} title="No meetings logged yet." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {meetings.map(m => (
              <div key={m.id} style={{ padding: '10px 12px', border: '1px solid var(--border-subtle)', borderRadius: 6, opacity: m.status === 'cancelled' ? 0.6 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{m.title}</span>
                  {m.meeting_type && <span className="pill" style={{ fontSize: 10, textTransform: 'capitalize' }}>{cap(m.meeting_type)}</span>}
                  <span className="pill" style={{ fontSize: 10, textTransform: 'capitalize',
                    background: m.status === 'completed' ? 'var(--status-success-bg)' : 'var(--bg-sunken)',
                    color: m.status === 'completed' ? 'var(--status-success-fg)' : 'var(--fg-subtle)' }}>{m.status}</span>
                  <div style={{ flex: 1 }} />
                  {canEdit && (
                    <>
                      <Select className="form-input" style={{ fontSize: 12, width: 'auto', padding: '2px 6px' }} value={m.status}
                        onChange={e => onSetStatus(m.id, e.target.value as Meeting['status'])} aria-label={`${m.title} status`}>
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </Select>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px', color: '#dc2626' }} onClick={() => onDelete(m.id)} aria-label="Remove meeting"><Trash2 size={13} /></button>
                    </>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 3 }}>
                  {new Date(m.meeting_at).toLocaleString()}
                  {m.location && ` · ${m.location}`}
                  {m.attendees && ` · ${m.attendees}`}
                </div>
                {m.notes && <div style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 4 }}>{m.notes}</div>}
                {m.outcome && <div style={{ fontSize: 12, marginTop: 4 }}><strong>Outcome:</strong> {m.outcome}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MeetingForm({ onSave, onCancel }: { onSave: (p: Record<string, unknown>) => Promise<boolean>; onCancel: () => void }) {
  const [f, setF] = useState({
    title: '', meeting_type: '', meeting_at: '', location: '', attendees: '', notes: '', outcome: '', status: 'scheduled',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  async function submit() {
    if (!f.title.trim() || !f.meeting_at) return;
    setSaving(true);
    await onSave({
      title: f.title.trim(), meeting_type: f.meeting_type || null,
      meeting_at: new Date(f.meeting_at).toISOString(),
      location: f.location.trim() || null, attendees: f.attendees.trim() || null,
      notes: f.notes.trim() || null, outcome: f.outcome.trim() || null, status: f.status,
    });
    setSaving(false);
  }

  return (
    <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '12px 14px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 190px', gap: 8, marginBottom: 8 }}>
        <div><label className="form-label required" style={{ fontSize: 11 }}>Title</label>
          <input className="form-input" style={{ fontSize: 13 }} placeholder="e.g. Site visit" value={f.title} onChange={set('title')} autoFocus /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Type</label>
          <Select className="form-input" style={{ fontSize: 13 }} value={f.meeting_type} onChange={set('meeting_type')}>
            <option value="">—</option>{MEETING_TYPES.map(t => <option key={t} value={t}>{cap(t)}</option>)}
          </Select></div>
        <div><label className="form-label required" style={{ fontSize: 11 }}>Date & time</label>
          <input type="datetime-local" className="form-input" style={{ fontSize: 13 }} value={f.meeting_at} onChange={set('meeting_at')} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 150px', gap: 8, marginBottom: 8 }}>
        <div><label className="form-label" style={{ fontSize: 11 }}>Location</label><input className="form-input" style={{ fontSize: 13 }} value={f.location} onChange={set('location')} /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Attendees</label><input className="form-input" style={{ fontSize: 13 }} placeholder="Names, comma separated" value={f.attendees} onChange={set('attendees')} /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Status</label>
          <Select className="form-input" style={{ fontSize: 13 }} value={f.status} onChange={set('status')}>
            <option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
          </Select></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div><label className="form-label" style={{ fontSize: 11 }}>Notes</label><textarea className="form-input" rows={2} style={{ fontSize: 13, resize: 'vertical' }} value={f.notes} onChange={set('notes')} /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Outcome</label><textarea className="form-input" rows={2} style={{ fontSize: 13, resize: 'vertical' }} value={f.outcome} onChange={set('outcome')} /></div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={!f.title.trim() || !f.meeting_at || saving}>{saving ? 'Saving…' : 'Save meeting'}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
