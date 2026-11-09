import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { tableMissing, validateRequest } from '@/lib/hr/requests';
import { teamOf } from '@/lib/hr/team';

// Mobile HR: leave (018) and punch-correction (034) requests; the team view feeds manager approval (066).
const COLS = 'id, user_id, kind, reason, start_date, end_date, correction_kind, correction_at, priority, description, status, decision_note, decided_by, decided_at, created_at';
const MISSING = 'HR is not set up yet — migration 145_hr_and_warehouse.sql has not been applied.';

/** GET ?scope=mine (default) | team — team = the people I may decide for (manager / ops / GM). */
export async function GET(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const scope = req.nextUrl.searchParams.get('scope') === 'team' ? 'team' : 'mine';

  let names: Record<string, string> = {};
  let q = admin.from('hr_requests').select(COLS).order('created_at', { ascending: false }).limit(300);
  if (scope === 'mine') q = q.eq('user_id', user.id);
  else {
    const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const team = await teamOf(admin, { id: user.id, role: me?.role ?? null });
    if (!team.length) return NextResponse.json({ requests: [], names: {} });
    names = Object.fromEntries(team.map(t => [t.id, t.full_name]));
    q = q.in('user_id', team.map(t => t.id));
  }
  const { data, error } = await q;
  if (tableMissing(error, 'hr_requests')) return NextResponse.json({ error: MISSING }, { status: 503 });
  if (error) return NextResponse.json({ error: 'Could not load requests' }, { status: 500 });
  return NextResponse.json({ requests: data ?? [], names });
}

/** POST — a request for myself. */
export async function POST(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const b = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const v = validateRequest(b);
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data, error } = await admin.from('hr_requests').insert({ ...v.value, user_id: user.id }).select(COLS).single();
  if (tableMissing(error, 'hr_requests')) return NextResponse.json({ error: MISSING }, { status: 503 });
  if (error) return NextResponse.json({ error: 'Could not save the request' }, { status: 500 });

  await logAudit({ actorId: user.id, action: `hr.request_${v.value.kind}`, resource: `hr_request:${data.id}`, newValue: v.value });
  return NextResponse.json({ request: data });
}
