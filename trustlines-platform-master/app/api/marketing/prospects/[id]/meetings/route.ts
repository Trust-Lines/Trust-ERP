import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_READ_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';
import { EVENT_COLS } from '@/lib/google/meetings';

type Params = { params: Promise<{ id: string }> };

// Meetings the team had (or will have) with this Contact, from everyone's connected Google
// Calendar — title, time, who organized it, Meet / recording links. No meeting notes from Google.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role, 'read');
  if (denied) return denied;

  const { data, error } = await admin.from('google_calendar_events').select(EVENT_COLS)
    .eq('prospect_id', id).neq('status', 'cancelled').order('starts_at', { ascending: false }).limit(100);
  if (error) {
    const notReady = error.code === 'PGRST205' || error.code === '42P01';
    return NextResponse.json({ meetings: [], notReady });
  }
  // The same meeting appears once per connected attendee — show it once.
  const seen = new Set<string>();
  const meetings = ((data ?? []) as { google_event_id: string; starts_at: string; title: string }[])
    .filter(m => { const k = `${m.title}|${m.starts_at}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const userIds = [...new Set((data ?? []).map((m: { user_id: string }) => m.user_id))];
  const { data: people } = userIds.length ? await admin.from('profiles').select('id, full_name, email').in('id', userIds) : { data: [] };
  return NextResponse.json({
    meetings,
    people: Object.fromEntries(((people ?? []) as { id: string; full_name: string | null; email: string }[]).map(p => [p.id, p.full_name || p.email])),
  });
}
