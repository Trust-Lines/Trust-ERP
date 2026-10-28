import { createEvent, mapEvent, type NewMeeting } from '@/lib/google/calendar';
import { googleTokenFor } from '@/lib/google/oauth';
import { isEmail, normalizeEmail } from '@/lib/email/compose';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Creating a meeting from the ERP: Google Calendar event (+ Meet link) on the person's own
// calendar, invitation emailed to the attendees, and the copy stored already linked to the
// Contact / Customer it's for.

export const EVENT_COLS = 'id, user_id, google_event_id, title, description, location, starts_at, ends_at, all_day, status, organizer_email, attendees, meet_url, html_link, recording_url, transcript_url, prospect_id, customer_id, customer_meeting_id, created_in_erp';

export class MeetingError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export interface MeetingInput {
  title: string;
  startsAt: string;
  durationMin: number;
  attendees: string[];
  description?: string | null;
  location?: string | null;
  withMeet?: boolean;
  prospectId?: string | null;
  customerId?: string | null;
  customerMeetingId?: string | null;
}

export function parseMeetingInput(raw: unknown): MeetingInput {
  const b = (raw ?? {}) as Record<string, unknown>;
  const title = typeof b.title === 'string' ? b.title.trim().slice(0, 200) : '';
  if (!title) throw new MeetingError('Give the meeting a title');
  const start = new Date(String(b.startsAt ?? ''));
  if (Number.isNaN(start.getTime())) throw new MeetingError('Pick the date and time');
  if (start.getTime() < Date.now() - 5 * 60_000) throw new MeetingError('The meeting time is in the past');
  const durationMin = Number(b.durationMin ?? 30);
  if (!Number.isInteger(durationMin) || durationMin < 5 || durationMin > 600) throw new MeetingError('Duration must be between 5 minutes and 10 hours');
  const attendees = [...new Set((Array.isArray(b.attendees) ? b.attendees : []).filter((e): e is string => typeof e === 'string').map(e => normalizeEmail(e)).filter(Boolean))];
  const bad = attendees.find(e => !isEmail(e));
  if (bad) throw new MeetingError(`“${bad}” isn’t a valid email address`);
  if (attendees.length > 50) throw new MeetingError('At most 50 attendees');
  const id = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
  return {
    title, startsAt: start.toISOString(), durationMin, attendees,
    description: typeof b.description === 'string' ? b.description.trim().slice(0, 4000) || null : null,
    location: typeof b.location === 'string' ? b.location.trim().slice(0, 300) || null : null,
    withMeet: b.withMeet !== false,
    prospectId: id(b.prospectId), customerId: id(b.customerId), customerMeetingId: id(b.customerMeetingId),
  };
}

export async function createMeeting(admin: any, userId: string, m: MeetingInput) {
  const { token } = await googleTokenFor(admin, userId);
  const event: NewMeeting = {
    title: m.title, startsAt: m.startsAt, endsAt: new Date(new Date(m.startsAt).getTime() + m.durationMin * 60_000).toISOString(),
    attendees: m.attendees, description: m.description, location: m.location, withMeet: m.withMeet !== false,
  };
  const created = await createEvent(token, event);
  const row = mapEvent(created);
  if (!row) throw new MeetingError('Google created the event but returned no details', 502);
  const { data, error } = await admin.from('google_calendar_events').upsert({
    user_id: userId, ...row, created_in_erp: true,
    prospect_id: m.prospectId ?? null, customer_id: m.customerId ?? null, customer_meeting_id: m.customerMeetingId ?? null,
  }, { onConflict: 'user_id,google_event_id' }).select(EVENT_COLS).single();
  if (error) throw new Error(`The meeting is on your Google Calendar but couldn’t be saved here: ${error.message}`);
  return data;
}
