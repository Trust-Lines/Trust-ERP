import { randomUUID } from 'node:crypto';
import { getJson, requestJson, qs } from '@/lib/social/http';

// Google Calendar API v3 (primary calendar) + Google Meet REST API v2 (recordings/transcripts).
// Pure mapping is exported for the tests; the fetch helpers take a ready access token.

const CAL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const MEET = 'https://meet.googleapis.com/v2';
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export interface GoogleEvent {
  id: string; status?: string; summary?: string; description?: string; location?: string; htmlLink?: string; updated?: string;
  start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string };
  organizer?: { email?: string };
  attendees?: { email?: string; displayName?: string; responseStatus?: string; resource?: boolean }[];
  hangoutLink?: string;
  conferenceData?: { conferenceId?: string; conferenceSolution?: { key?: { type?: string } }; entryPoints?: { entryPointType?: string; uri?: string }[] };
}

export interface EventRow {
  google_event_id: string; title: string; description: string | null; location: string | null;
  starts_at: string; ends_at: string | null; all_day: boolean; status: 'confirmed' | 'tentative' | 'cancelled';
  organizer_email: string | null; attendees: { email: string; name: string | null; response: string | null }[];
  meet_url: string | null; meet_code: string | null; html_link: string | null; google_updated_at: string | null;
}

/** All-day events come as a date; store them as UTC midnight so they sort with the timed ones. */
const toIso = (t?: { dateTime?: string; date?: string }) =>
  t?.dateTime ? new Date(t.dateTime).toISOString() : t?.date ? `${t.date}T00:00:00.000Z` : null;

export function mapEvent(e: GoogleEvent): EventRow | null {
  const starts = toIso(e.start);
  if (!e.id || !starts) return null;
  const video = e.conferenceData?.entryPoints?.find(p => p.entryPointType === 'video')?.uri;
  const isMeet = e.conferenceData?.conferenceSolution?.key?.type === 'hangoutsMeet' || !!e.hangoutLink;
  const status = e.status === 'cancelled' ? 'cancelled' : e.status === 'tentative' ? 'tentative' : 'confirmed';
  return {
    google_event_id: e.id,
    title: (e.summary ?? '').trim() || '(no title)',
    description: e.description ? e.description.slice(0, 4000) : null,
    location: e.location ?? null,
    starts_at: starts,
    ends_at: toIso(e.end),
    all_day: !e.start?.dateTime,
    status,
    organizer_email: e.organizer?.email?.toLowerCase() ?? null,
    attendees: (e.attendees ?? []).filter(a => a.email && !a.resource)
      .map(a => ({ email: a.email!.toLowerCase(), name: a.displayName ?? null, response: a.responseStatus ?? null })),
    meet_url: e.hangoutLink ?? video ?? null,
    meet_code: isMeet ? e.conferenceData?.conferenceId ?? null : null,
    html_link: e.htmlLink ?? null,
    google_updated_at: e.updated ? new Date(e.updated).toISOString() : null,
  };
}

/** Every event (recurring ones expanded) between two times, cancelled ones included. */
export async function listEvents(token: string, timeMin: string, timeMax: string): Promise<GoogleEvent[]> {
  const out: GoogleEvent[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page++) {
    const res = await getJson<{ items?: GoogleEvent[]; nextPageToken?: string }>(`${CAL}?${qs({
      timeMin, timeMax, singleEvents: 'true', showDeleted: 'true', orderBy: 'startTime', maxResults: 250, pageToken,
    })}`, auth(token));
    out.push(...(res.items ?? []));
    pageToken = res.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

export interface NewMeeting {
  title: string;
  startsAt: string; // ISO
  endsAt: string;   // ISO
  attendees: string[];
  description?: string | null;
  location?: string | null;
  withMeet: boolean;
}

/** Creates the event on the person's calendar and emails the invitation to the attendees. */
export async function createEvent(token: string, m: NewMeeting): Promise<GoogleEvent> {
  const body = {
    summary: m.title,
    description: m.description || undefined,
    location: m.location || undefined,
    start: { dateTime: m.startsAt },
    end: { dateTime: m.endsAt },
    attendees: m.attendees.map(email => ({ email })),
    ...(m.withMeet ? { conferenceData: { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } } } : {}),
  };
  const res = await requestJson<GoogleEvent>(`${CAL}?${qs({ conferenceDataVersion: 1, sendUpdates: 'all' })}`, {
    method: 'POST', headers: { ...auth(token), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return res.data;
}

/** Cancels the event and tells the attendees. */
export async function cancelEvent(token: string, eventId: string): Promise<void> {
  const res = await fetch(`${CAL}/${encodeURIComponent(eventId)}?${qs({ sendUpdates: 'all' })}`, {
    method: 'DELETE', headers: auth(token), signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok && res.status !== 410 && res.status !== 404) throw new Error(`Google refused to cancel the event (${res.status})`);
}

/** Recording and transcript links of a finished Meet call, when the call was recorded. */
export async function meetArtifacts(token: string, meetCode: string): Promise<{ recording: string | null; transcript: string | null }> {
  const records = await getJson<{ conferenceRecords?: { name: string }[] }>(
    `${MEET}/conferenceRecords?${qs({ filter: `space.meeting_code = "${meetCode.replace(/"/g, '')}"`, pageSize: 5 })}`, auth(token),
  );
  let recording: string | null = null, transcript: string | null = null;
  for (const r of records.conferenceRecords ?? []) {
    const [recs, trans] = await Promise.all([
      getJson<{ recordings?: { state?: string; driveDestination?: { exportUri?: string } }[] }>(`${MEET}/${r.name}/recordings`, auth(token)).catch(() => ({ recordings: [] })),
      getJson<{ transcripts?: { state?: string; docsDestination?: { exportUri?: string } }[] }>(`${MEET}/${r.name}/transcripts`, auth(token)).catch(() => ({ transcripts: [] })),
    ]);
    recording ??= recs.recordings?.find(x => x.state === 'FILE_GENERATED' && x.driveDestination?.exportUri)?.driveDestination?.exportUri ?? null;
    transcript ??= trans.transcripts?.find(x => x.state === 'FILE_GENERATED' && x.docsDestination?.exportUri)?.docsDestination?.exportUri ?? null;
  }
  return { recording, transcript };
}
