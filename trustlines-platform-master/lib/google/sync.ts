import { googleTokenFor } from '@/lib/google/oauth';
import { listEvents, mapEvent, meetArtifacts, type EventRow } from '@/lib/google/calendar';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Copies a person's Google Calendar into google_calendar_events and links each meeting to the
// Contact / Customer it was with. Read-only on Google.

const DAY = 86_400_000;
export const SYNC_PAST_DAYS = 60;
export const SYNC_FUTURE_DAYS = 120;
const FREE_MAIL = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com']);

/** Attendee emails worth matching: not the person themself, not colleagues on the same company domain. */
export function externalAttendees(row: Pick<EventRow, 'attendees' | 'organizer_email'>, ownEmail: string): string[] {
  const own = ownEmail.toLowerCase();
  const domain = own.split('@')[1] ?? '';
  const internal = domain && !FREE_MAIL.has(domain) ? domain : null;
  const emails = [...row.attendees.map(a => a.email), row.organizer_email ?? ''].filter(Boolean);
  return [...new Set(emails)].filter(e => e !== own && (!internal || !e.endsWith(`@${internal}`)));
}

// `ilike` without wildcards = case-insensitive equals; `_` and `%` in an address must be escaped.
const exactI = (col: string, email: string) => `${col}.ilike.${email.replace(/[\\%_]/g, '\\$&')}`;

async function lookup(admin: any, table: string, col: string, select: string, emails: string[]) {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < emails.length; i += 40) {
    const chunk = emails.slice(i, i + 40);
    let q = admin.from(table).select(select).or(chunk.map(e => exactI(col, e)).join(','));
    if (table === 'prospects') q = q.is('deleted_at', null);
    const { data, error } = await q.limit(500);
    if (!error) out.push(...(data ?? []));
  }
  return out;
}

/** email → { prospect_id, customer_id } from Contacts (main address + people) and Customer contacts. */
export async function matchEmails(admin: any, emails: string[]): Promise<Map<string, { prospect_id: string | null; customer_id: string | null }>> {
  const map = new Map<string, { prospect_id: string | null; customer_id: string | null }>();
  if (!emails.length) return map;
  const [prospects, people, customerContacts] = await Promise.all([
    lookup(admin, 'prospects', 'main_email', 'id, main_email', emails),
    lookup(admin, 'prospect_contacts', 'email', 'prospect_id, email', emails),
    lookup(admin, 'customer_contacts', 'email', 'customer_id, email', emails),
  ]);
  const get = (e: string) => map.get(e) ?? { prospect_id: null, customer_id: null };
  for (const p of prospects as { id: string; main_email: string }[]) { const e = p.main_email.toLowerCase(); map.set(e, { ...get(e), prospect_id: get(e).prospect_id ?? p.id }); }
  for (const p of people as { prospect_id: string; email: string }[]) { const e = p.email.toLowerCase(); map.set(e, { ...get(e), prospect_id: get(e).prospect_id ?? p.prospect_id }); }
  for (const c of customerContacts as { customer_id: string; email: string }[]) { const e = c.email.toLowerCase(); map.set(e, { ...get(e), customer_id: get(e).customer_id ?? c.customer_id }); }
  return map;
}

export interface SyncSummary { events: number; linked: number; recordings: number }

export async function syncGoogleCalendar(admin: any, userId: string): Promise<SyncSummary> {
  const { token, email, scopes } = await googleTokenFor(admin, userId);
  try {
    const now = Date.now();
    const items = await listEvents(token, new Date(now - SYNC_PAST_DAYS * DAY).toISOString(), new Date(now + SYNC_FUTURE_DAYS * DAY).toISOString());
    const rows = items.map(mapEvent).filter((r): r is EventRow => !!r);

    const external = new Map(rows.map(r => [r.google_event_id, externalAttendees(r, email)]));
    const matches = await matchEmails(admin, [...new Set([...external.values()].flat())]);

    const { data: existing } = await admin.from('google_calendar_events')
      .select('google_event_id, prospect_id, customer_id').eq('user_id', userId);
    const known = new Map(((existing ?? []) as { google_event_id: string; prospect_id: string | null; customer_id: string | null }[]).map(r => [r.google_event_id, r]));

    let linked = 0;
    const payload = rows.map(r => {
      const before = known.get(r.google_event_id);
      const hit = (external.get(r.google_event_id) ?? []).map(e => matches.get(e)).filter(Boolean);
      // A link set when the meeting was created in the ERP (or matched earlier) is kept.
      const prospect_id = before?.prospect_id ?? hit.find(h => h!.prospect_id)?.prospect_id ?? null;
      const customer_id = before?.customer_id ?? hit.find(h => h!.customer_id)?.customer_id ?? null;
      if (prospect_id || customer_id) linked += 1;
      return { user_id: userId, ...r, prospect_id, customer_id };
    });
    for (let i = 0; i < payload.length; i += 200) {
      const { error } = await admin.from('google_calendar_events').upsert(payload.slice(i, i + 200), { onConflict: 'user_id,google_event_id' });
      if (error) throw new Error(`Could not save the meetings: ${error.message}`);
    }

    // Recordings / transcripts of Meet calls that ended in the last 30 days (checked at most every 6 h).
    let recordings = 0;
    if (scopes.some(s => s.includes('meetings.space'))) {
      const { data: due } = await admin.from('google_calendar_events').select('id, meet_code')
        .eq('user_id', userId).not('meet_code', 'is', null).is('recording_url', null).neq('status', 'cancelled')
        .lt('ends_at', new Date(now).toISOString()).gt('ends_at', new Date(now - 30 * DAY).toISOString())
        .or(`recording_checked_at.is.null,recording_checked_at.lt.${new Date(now - 6 * 3_600_000).toISOString()}`)
        .order('ends_at', { ascending: false }).limit(8);
      for (const ev of (due ?? []) as { id: string; meet_code: string }[]) {
        const a = await meetArtifacts(token, ev.meet_code).catch(() => ({ recording: null, transcript: null }));
        if (a.recording || a.transcript) recordings += 1;
        await admin.from('google_calendar_events').update({
          recording_url: a.recording, transcript_url: a.transcript, recording_checked_at: new Date().toISOString(),
        }).eq('id', ev.id);
      }
    }

    await admin.from('user_google_connections').update({ last_sync_at: new Date().toISOString(), last_error: null }).eq('user_id', userId);
    return { events: rows.length, linked, recordings };
  } catch (e) {
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 400);
    await admin.from('user_google_connections').update({ last_error: message }).eq('user_id', userId);
    throw e;
  }
}

/** Cron: everyone whose calendar hasn't synced in the last 30 minutes (oldest first). */
export async function syncAllGoogleCalendars(admin: any) {
  const stale = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data } = await admin.from('user_google_connections').select('user_id')
    .or(`last_sync_at.is.null,last_sync_at.lt.${stale}`).order('last_sync_at', { ascending: true, nullsFirst: true }).limit(25);
  const results: { userId: string; ok: boolean; error?: string }[] = [];
  for (const { user_id } of (data ?? []) as { user_id: string }[]) {
    try { await syncGoogleCalendar(admin, user_id); results.push({ userId: user_id, ok: true }); }
    catch (e) { results.push({ userId: user_id, ok: false, error: e instanceof Error ? e.message : String(e) }); }
  }
  return results;
}
