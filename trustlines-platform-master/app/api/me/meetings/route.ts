import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { GoogleNotConnected } from '@/lib/google/oauth';
import { createMeeting, EVENT_COLS, MeetingError, parseMeetingInput } from '@/lib/google/meetings';
import { PlatformError } from '@/lib/social/http';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const maxDuration = 60;

// My meetings: the person's own Google Calendar copy, with who each meeting was with.
export async function GET(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const admin = createAdminClient() as any;
  const range = new URL(req.url).searchParams.get('range') === 'past' ? 'past' : 'upcoming';
  const now = new Date().toISOString();

  let q = admin.from('google_calendar_events').select(EVENT_COLS).eq('user_id', user.id).neq('status', 'cancelled');
  q = range === 'past' ? q.lt('starts_at', now).order('starts_at', { ascending: false }) : q.gte('ends_at', now).order('starts_at', { ascending: true });
  const { data, error } = await q.limit(300);
  if (error) {
    const notReady = error.code === 'PGRST205' || error.code === '42P01';
    return NextResponse.json({ error: notReady ? 'Meetings aren’t set up yet (migration 130).' : 'Could not load your meetings' }, { status: notReady ? 503 : 500 });
  }
  const rows = (data ?? []) as { prospect_id: string | null; customer_id: string | null }[];
  const pIds = [...new Set(rows.map(r => r.prospect_id).filter(Boolean))];
  const cIds = [...new Set(rows.map(r => r.customer_id).filter(Boolean))];
  const [{ data: prospects }, { data: customers }, { data: conn }] = await Promise.all([
    pIds.length ? admin.from('prospects').select('id, display_name').in('id', pIds) : { data: [] },
    cIds.length ? admin.from('customers').select('id, name').in('id', cIds) : { data: [] },
    admin.from('user_google_connections').select('google_email, last_sync_at, last_error, scopes').eq('user_id', user.id).maybeSingle(),
  ]);
  return NextResponse.json({
    meetings: data ?? [],
    prospects: Object.fromEntries(((prospects ?? []) as { id: string; display_name: string }[]).map(p => [p.id, p.display_name])),
    customers: Object.fromEntries(((customers ?? []) as { id: string; name: string }[]).map(c => [c.id, c.name])),
    connection: conn ?? null,
  });
}

// "Schedule meeting": Google Calendar event with a Meet link; Google emails the invitations.
export async function POST(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const admin = createAdminClient() as any;
  try {
    const input = parseMeetingInput(await req.json().catch(() => null));
    const meeting = await createMeeting(admin, user.id, input);
    await logAudit({ actorId: user.id, action: 'meeting.created', resource: `google_event:${meeting.google_event_id}`, newValue: { title: input.title, attendees: input.attendees.length, prospect: input.prospectId, customer: input.customerId } });
    return NextResponse.json({ meeting }, { status: 201 });
  } catch (e) {
    if (e instanceof MeetingError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof GoogleNotConnected) return NextResponse.json({ error: e.message }, { status: 412 });
    if (e instanceof PlatformError) return NextResponse.json({ error: `Google said: ${e.message}` }, { status: 502 });
    console.error('[meeting create]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not create the meeting' }, { status: 500 });
  }
}
