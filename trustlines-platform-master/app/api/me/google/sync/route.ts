import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GoogleNotConnected } from '@/lib/google/oauth';
import { syncGoogleCalendar } from '@/lib/google/sync';

export const maxDuration = 120;

// "Sync now" on My meetings / Settings.
export async function POST() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  try {
    return NextResponse.json(await syncGoogleCalendar(createAdminClient(), user.id));
  } catch (e) {
    if (e instanceof GoogleNotConnected) return NextResponse.json({ error: e.message }, { status: 412 });
    const message = e instanceof Error ? e.message : String(e);
    console.error('[google sync]', message);
    return NextResponse.json({ error: `Could not sync Google Calendar: ${message.slice(0, 200)}` }, { status: 502 });
  }
}
