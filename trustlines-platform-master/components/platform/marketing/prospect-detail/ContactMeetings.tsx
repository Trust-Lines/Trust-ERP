'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, FileText, Plus, Video } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ScheduleMeetingDialog } from '@/components/platform/meetings/ScheduleMeetingDialog';

// Contact → Emails & activity → Meetings: every meeting the team had (or has booked) with this
// Contact, from the connected Google Calendars, and "Schedule meeting" with a Meet link.

interface Meeting {
  id: string; user_id: string; title: string; starts_at: string; ends_at: string | null; all_day: boolean;
  meet_url: string | null; recording_url: string | null; transcript_url: string | null;
}

const WHEN = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export function ContactMeetings({ prospectId, contactName, emails, canEdit }: {
  prospectId: string; contactName: string; emails: string[]; canEdit?: boolean;
}) {
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [people, setPeople] = useState<Record<string, string>>({});
  const [notReady, setNotReady] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/marketing/prospects/${prospectId}/meetings`);
    const b = await res.json().catch(() => ({}));
    setNotReady(!!b.notReady);
    setMeetings(b.meetings ?? []);
    setPeople(b.people ?? {});
  }, [prospectId]);
  useEffect(() => { setNow(Date.now()); load(); }, [load]);

  if (notReady) return null;
  const upcoming = (meetings ?? []).filter(m => now !== null && new Date(m.ends_at ?? m.starts_at).getTime() >= now).reverse();
  const past = (meetings ?? []).filter(m => now !== null && new Date(m.ends_at ?? m.starts_at).getTime() < now);

  const row = (m: Meeting, isPast: boolean) => (
    <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-ui-heading">{m.title}</div>
        <div className="text-[12px] text-ui-text-secondary">
          {m.all_day ? new Date(m.starts_at).toLocaleDateString('en-US', { timeZone: 'UTC' }) : WHEN.format(new Date(m.starts_at))}
          {people[m.user_id] ? ` · ${people[m.user_id]}` : ''}
        </div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        {!isPast && m.meet_url && <a href={m.meet_url} target="_blank" rel="noreferrer" className={buttonVariants({ size: 'xs' })}><Video className="size-3" /> Join</a>}
        {m.recording_url && <a href={m.recording_url} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'secondary', size: 'xs' })}><Video className="size-3" /> Recording</a>}
        {m.transcript_url && <a href={m.transcript_url} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'secondary', size: 'xs' })}><FileText className="size-3" /> Transcript</a>}
      </div>
    </li>
  );

  return (
    <div className="mb-5 border-b border-ui-divider pb-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="m-0 text-[15px] font-semibold">Meetings</h3>
          <p className="m-0 text-[12px] text-ui-text-secondary">From the team’s connected Google Calendars — matched by attendee email.</p>
        </div>
        {canEdit && <Button variant="secondary" onClick={() => setScheduling(true)}><Plus /> Schedule meeting</Button>}
      </div>
      {meetings === null ? <p className="m-0 text-[13px] text-ui-text-secondary">Loading…</p> : meetings.length === 0 ? (
        <EmptyState size="sm" icon={<CalendarDays />} title="No meetings with this Contact yet" />
      ) : (
        <>
          {upcoming.length > 0 && <><div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-ui-text-secondary">Upcoming</div><ul className="m-0 list-none divide-y divide-ui-divider p-0">{upcoming.map(m => row(m, false))}</ul></>}
          {past.length > 0 && <><div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ui-text-secondary">Past</div><ul className="m-0 list-none divide-y divide-ui-divider p-0">{past.slice(0, 10).map(m => row(m, true))}</ul></>}
        </>
      )}
      {scheduling && (
        <ScheduleMeetingDialog
          defaults={{ title: `Meeting with ${contactName}`, attendees: emails, prospectId }}
          onClose={() => setScheduling(false)} onCreated={() => { setScheduling(false); load(); }}
        />
      )}
    </div>
  );
}
