import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { canManage, tableMissing } from '@/lib/hr/requests';
import { teamOf } from '@/lib/hr/team';

// Shift plan (033 mine / 068 manager plans). A plan row is a schedule, not a record of work —
// the manager may remove one; worked time always comes from time_punches.
const COLS = 'id, user_id, shift_date, start_time, end_time, site, note';
const MISSING = 'Shift plans are not set up yet — migration 145_hr_and_warehouse.sql has not been applied.';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function actorAndTarget(admin: any, actorId: string, targetId: string) {
  const [{ data: me }, { data: target }] = await Promise.all([
    admin.from('profiles').select('role').eq('id', actorId).maybeSingle(),
    admin.from('profiles').select('id, manager_id').eq('id', targetId).maybeSingle(),
  ]);
  return !!target && canManage({ id: actorId, role: me?.role ?? null }, target);
}

/** GET ?scope=mine|team&from=YYYY-MM-DD&to=YYYY-MM-DD (at most 62 days). */
export async function GET(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const sp = req.nextUrl.searchParams;
  const from = sp.get('from') ?? '', to = sp.get('to') ?? '';
  if (!DAY.test(from) || !DAY.test(to) || to < from || Date.parse(to) - Date.parse(from) > 62 * 864e5)
    return NextResponse.json({ error: 'from / to must be YYYY-MM-DD, at most 62 days apart' }, { status: 400 });

  let names: Record<string, string> = {};
  let q = admin.from('hr_shifts').select(COLS).gte('shift_date', from).lte('shift_date', to).order('shift_date').order('start_time').limit(2000);
  if (sp.get('scope') === 'team') {
    const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const team = await teamOf(admin, { id: user.id, role: me?.role ?? null });
    names = Object.fromEntries(team.map(t => [t.id, t.full_name]));
    if (!team.length) return NextResponse.json({ shifts: [], names });
    q = q.in('user_id', team.map(t => t.id));
  } else q = q.eq('user_id', user.id);

  const { data, error } = await q;
  if (tableMissing(error, 'hr_shifts')) return NextResponse.json({ error: MISSING }, { status: 503 });
  if (error) return NextResponse.json({ error: 'Could not load shifts' }, { status: 500 });
  return NextResponse.json({ shifts: data ?? [], names });
}

/** POST { user_id, shift_date, start_time, end_time, site?, note? } — plan a shift for someone I manage. */
export async function POST(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const b = await req.json().catch(() => null) as Record<string, unknown> | null;
  const userId = String(b?.user_id ?? ''), date = String(b?.shift_date ?? ''), start = String(b?.start_time ?? ''), end = String(b?.end_time ?? '');
  if (!userId || !DAY.test(date) || !TIME.test(start) || !TIME.test(end))
    return NextResponse.json({ error: 'user_id, shift_date (YYYY-MM-DD), start_time and end_time (HH:MM) are required' }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  if (!(await actorAndTarget(admin, user.id, userId))) return NextResponse.json({ error: 'You cannot plan shifts for this person' }, { status: 403 });

  const text = (k: string) => (typeof b?.[k] === 'string' ? (b[k] as string).trim().slice(0, 200) || null : null);
  const { data, error } = await admin.from('hr_shifts').insert({
    user_id: userId, shift_date: date, start_time: start, end_time: end, site: text('site'), note: text('note'), created_by: user.id,
  }).select(COLS).single();
  if (tableMissing(error, 'hr_shifts')) return NextResponse.json({ error: MISSING }, { status: 503 });
  if (error) return NextResponse.json({ error: 'Could not save the shift' }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'hr.shift_planned', resource: `hr_shift:${data.id}`, newValue: { user_id: userId, date, start, end } });
  return NextResponse.json({ shift: data });
}

/** DELETE ?id= — remove a planned shift (manager / ops / GM of that person). */
export async function DELETE(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const id = req.nextUrl.searchParams.get('id') ?? '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: s } = await admin.from('hr_shifts').select('id, user_id, shift_date').eq('id', id).maybeSingle();
  if (!s) return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
  if (!(await actorAndTarget(admin, user.id, s.user_id))) return NextResponse.json({ error: 'You cannot change this plan' }, { status: 403 });
  const { error } = await admin.from('hr_shifts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not remove the shift' }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'hr.shift_removed', resource: `hr_shift:${id}`, oldValue: s });
  return NextResponse.json({ ok: true });
}
