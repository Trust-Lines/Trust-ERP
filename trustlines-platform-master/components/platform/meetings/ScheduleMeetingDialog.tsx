'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CircleAlert, Video } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Modal, ModalClose, ModalContent, modalSecondaryButtonClass } from '@/components/ui/modal';

// "Schedule meeting": creates the event on the person's own Google Calendar with a Google Meet
// link; Google emails the invitation to the attendees. Used from My meetings and Contact pages.

const DURATIONS = [15, 30, 45, 60, 90, 120].map(m => ({ value: String(m), label: `${m} min` }));
const label = 'flex flex-col gap-1 text-[12px] font-medium text-ui-body';

/** Next round half hour in the viewer's time zone, as a datetime-local value. */
function nextSlot(): string {
  const d = new Date(Date.now() + 30 * 60_000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export interface ScheduleDefaults {
  title?: string;
  attendees?: string[];
  prospectId?: string | null;
  customerId?: string | null;
}

export function ScheduleMeetingDialog({ defaults, onClose, onCreated }: {
  defaults?: ScheduleDefaults;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState(defaults?.title ?? '');
  const [when, setWhen] = useState(nextSlot);
  const [duration, setDuration] = useState('30');
  const [attendees, setAttendees] = useState((defaults?.attendees ?? []).join(', '));
  const [description, setDescription] = useState('');
  const [withMeet, setWithMeet] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/me/google').then(r => r.json()).then(b => setConnected(!!b.connection)).catch(() => setConnected(false));
  }, []);

  async function save() {
    if (!title.trim() || !when) { toast.error('Add a title and pick the time'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/me/meetings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, startsAt: new Date(when).toISOString(), durationMin: Number(duration), withMeet, description,
          attendees: attendees.split(/[,;\s]+/).map(e => e.trim()).filter(Boolean),
          prospectId: defaults?.prospectId ?? null, customerId: defaults?.customerId ?? null,
        }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(b.error ?? 'Could not create the meeting', { duration: 10_000 }); return; }
      toast.success(b.meeting?.meet_url ? 'Meeting created — invitations sent with a Google Meet link' : 'Meeting created — invitations sent');
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onOpenChange={o => { if (!o) onClose(); }}>
      <ModalContent
        size="lg" title="Schedule meeting"
        description="Added to your Google Calendar; Google emails the invitation to everyone below."
        footer={(
          <>
            <ModalClose render={<Button variant="secondary" className={modalSecondaryButtonClass} />}>Cancel</ModalClose>
            <Button loading={saving} disabled={connected === false} onClick={save}><Video /> Create &amp; send invites</Button>
          </>
        )}
      >
        <div className="flex flex-col gap-4">
          {connected === false && (
            <div role="alert" className="flex flex-wrap items-center gap-2 rounded-[6px] bg-warning-light px-3 py-2 text-[12px] text-warning-dark">
              <CircleAlert className="size-4 shrink-0" aria-hidden /> Connect your Google account first.
              <Link href="/settings" className={buttonVariants({ variant: 'secondary', size: 'xs' })}>Open Settings</Link>
            </div>
          )}
          <label className={label}>Title
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Store layout review" />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_160px]">
            <label className={label}>Date &amp; time (your time)
              <Input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} />
            </label>
            <div className={label}>Duration
              <Select aria-label="Duration" value={duration} options={DURATIONS} onValueChange={v => setDuration(v ?? '30')} />
            </div>
          </div>
          <label className={label}>Invite (emails)
            <Input value={attendees} onChange={e => setAttendees(e.target.value)} placeholder="name@company.com, …" />
          </label>
          <label className={label}>Agenda / notes (shown in the invitation)
            <Textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-[12px] text-ui-body">
            <input type="checkbox" className="size-4 accent-[var(--color-secondary-700)]" checked={withMeet} onChange={e => setWithMeet(e.target.checked)} />
            Add a Google Meet video link
          </label>
        </div>
      </ModalContent>
    </Modal>
  );
}
