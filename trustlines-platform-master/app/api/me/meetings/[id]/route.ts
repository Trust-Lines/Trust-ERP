import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { cancelEvent } from '@/lib/google/calendar';
import { GoogleNotConnected, googleTokenFor } from '@/lib/google/oauth';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Params = { params: Promise<{ id: string }> };

// Cancel one of MY meetings: removed from Google Calendar, attendees get the cancellation.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const admin = createAdminClient() as any;
  const { data: ev } = await admin.from('google_calendar_events').select('id, google_event_id, title, organizer_email, customer_meeting_id')
    .eq('id', id).eq('user_id', user.id).maybeSingle();
  if (!ev) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  try {
    const { token, email } = await googleTokenFor(admin, user.id);
    if (ev.organizer_email && ev.organizer_email !== email) {
      return NextResponse.json({ error: 'Only the organizer can cancel this meeting — decline it in Google Calendar instead.' }, { status: 403 });
    }
    await cancelEvent(token, ev.google_event_id);
  } catch (e) {
    if (e instanceof GoogleNotConnected) return NextResponse.json({ error: e.message }, { status: 412 });
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not cancel' }, { status: 502 });
  }
  await admin.from('google_calendar_events').update({ status: 'cancelled' }).eq('id', id);
  if (ev.customer_meeting_id) await admin.from('customer_meetings').update({ status: 'cancelled' }).eq('id', ev.customer_meeting_id);
  await logAudit({ actorId: user.id, action: 'meeting.cancelled', resource: `google_event:${ev.google_event_id}`, newValue: { title: ev.title } });
  return NextResponse.json({ ok: true });
}
