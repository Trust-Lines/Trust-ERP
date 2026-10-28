'use client';

import { useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { Select } from '@/components/platform/shared/Select';
import { MEETING_TYPES, cap, type Meeting } from './types';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { AddButton, DetailCard, FORM_BOX, IconAction, RowList } from './ui';

export function MeetingsCard({ meetings, canEdit, contactEmails = [], onSave, onSetStatus, onDelete }: {
  meetings: Meeting[];
  canEdit?: boolean;
  /** The customer's contact emails — pre-filled as Google invite attendees. */
  contactEmails?: string[];
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
    <DetailCard
      title={`Meetings (${meetings.length})`}
      action={canEdit && !addingMeeting ? <AddButton label="Add Meeting" onClick={() => setAddingMeeting(true)} /> : undefined}
    >
      {addingMeeting && canEdit && <MeetingForm contactEmails={contactEmails} onSave={save} onCancel={() => setAddingMeeting(false)} />}
      {meetings.length === 0 && !addingMeeting ? (
        <EmptyState size="sm" icon={<CalendarDays />} title="No meetings logged yet." />
      ) : meetings.length > 0 && (
        <RowList>
          {meetings.map(m => {
            const tone = STATUS_TONE[m.status];
            const when = new Date(m.meeting_at);
            const whereWho = [m.attendees, m.location].filter(Boolean).join('  ·  ');
            return (
              <div key={m.id} className={cn('flex items-start gap-3 px-1 py-3', m.status === 'cancelled' && 'opacity-60')}>
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold leading-[1.4] text-ui-body">
                      {m.title}{m.meeting_type ? ` - ${cap(m.meeting_type).replace(/\b\w/g, c => c.toUpperCase())}` : ''}
                    </span>
                    {canEdit ? (
                      <label
                        className="relative inline-flex h-[18px] cursor-pointer items-center gap-1 rounded-[4px] px-2.5 text-[11px] font-medium capitalize leading-4"
                        style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}
                      >
                        {m.status}
                        <ChevronDown size={14} aria-hidden />
                        <select
                          aria-label={`${m.title} status`}
                          value={m.status}
                          onChange={e => onSetStatus(m.id, e.target.value as Meeting['status'])}
                          className="absolute inset-0 cursor-pointer opacity-0"
                        >
                          <option value="scheduled">Scheduled</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </label>
                    ) : (
                      <span className="inline-flex h-[18px] items-center rounded-[4px] px-2.5 text-[11px] font-medium capitalize leading-4"
                        style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}>
                        {m.status}
                      </span>
                    )}
                  </div>
                  {whereWho && <p className="m-0 break-words text-[11px] leading-[1.4] text-ui-body">{whereWho}</p>}
                  <p className="m-0 text-[11px] leading-[1.4] text-ui-text-secondary">
                    {when.toLocaleDateString('en-US')} · {when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {m.meet_url && m.status !== 'cancelled' && (
                    <a href={m.meet_url} target="_blank" rel="noreferrer" className="w-fit text-[11px] font-semibold text-ui-link hover:underline">Join Google Meet ↗</a>
                  )}
                  {m.notes && <p className="m-0 break-words text-[11px] leading-[1.4] text-ui-text-secondary">{m.notes}</p>}
                  {m.outcome && (
                    <p className="m-0 break-words text-[12px] leading-[1.4] text-ui-body">
                      <span className="text-[13px] font-semibold">Outcome: </span>{m.outcome}
                    </p>
                  )}
                </div>
                {canEdit && <IconAction kind="delete" label="Remove meeting" onClick={() => onDelete(m.id)} />}
              </div>
            );
          })}
        </RowList>
      )}
    </DetailCard>
  );
}

const STATUS_TONE: Record<Meeting['status'], string> = { scheduled: 't0', completed: 't9', cancelled: 't10' };

function MeetingForm({ contactEmails, onSave, onCancel }: { contactEmails: string[]; onSave: (p: Record<string, unknown>) => Promise<boolean>; onCancel: () => void }) {
  const [f, setF] = useState({
    title: '', meeting_type: '', meeting_at: '', location: '', attendees: '', notes: '', outcome: '', status: 'scheduled',
    invite_emails: contactEmails.join(', '), duration: '60',
  });
  const [invite, setInvite] = useState(false);
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
      ...(invite ? { google: { invite: true, duration_min: Number(f.duration), attendee_emails: f.invite_emails.split(/[,;\s]+/).map(e => e.trim()).filter(Boolean) } } : {}),
    });
    setSaving(false);
  }

  return (
    <div className={FORM_BOX}>
      <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div><label className="form-label required" style={{ fontSize: 11 }}>Title</label>
          <input className="form-input" style={{ fontSize: 13 }} placeholder="e.g. Site visit" value={f.title} onChange={set('title')} autoFocus /></div>
        <div><label className="form-label" style={{ fontSize: 11 }}>Type</label>
          <Select className="form-input" style={{ fontSize: 13 }} value={f.meeting_type} onChange={set('meeting_type')}>
            <option value="">—</option>{MEETING_TYPES.map(t => <option key={t} value={t}>{cap(t)}</option>)}
          </Select></div>
        <div><label className="form-label required" style={{ fontSize: 11 }}>Date & time</label>
          <input type="datetime-local" className="form-input" style={{ fontSize: 13 }} value={f.meeting_at} onChange={set('meeting_at')} /></div>
      </div>
      <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
      {/* Google invite from the person's own Google account (Settings → Google account). */}
      <label className="mb-2 flex items-center gap-2 text-[12px] text-ui-body">
        <input type="checkbox" checked={invite} onChange={e => setInvite(e.target.checked)} />
        Send a Google Calendar invitation with a Google Meet link
      </label>
      {invite && (
        <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px]">
          <div><label className="form-label" style={{ fontSize: 11 }}>Invite (emails)</label>
            <input className="form-input" style={{ fontSize: 13 }} placeholder="name@company.com, …" value={f.invite_emails} onChange={set('invite_emails')} /></div>
          <div><label className="form-label" style={{ fontSize: 11 }}>Duration</label>
            <Select className="form-input" style={{ fontSize: 13 }} value={f.duration} onChange={set('duration')}>
              {[15, 30, 45, 60, 90, 120].map(m => <option key={m} value={m}>{m} min</option>)}
            </Select></div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={!f.title.trim() || !f.meeting_at || saving}>{saving ? 'Saving…' : 'Save meeting'}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
