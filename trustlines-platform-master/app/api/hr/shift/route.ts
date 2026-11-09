import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { punchAllowed, statusAfter } from '@/lib/hr/shift';
import type { TimePunchKind } from '@/types/database';

// Mobile "Mesai": the signed-in person's own clock-in / break / clock-out (migration 144).
// Everyone signs their own punches only — nobody punches for someone else here.

const COLS = 'id, kind, punched_at, site, lat, lng, accuracy_m, note';
const KINDS: TimePunchKind[] = ['in', 'break_start', 'break_end', 'out'];
const MAX_RANGE_MS = 62 * 24 * 3600 * 1000;
const MISSING_TABLE = 'Mesai is not set up yet — migration 144_time_punches.sql has not been applied.';

function tableMissing(e: { code?: string; message?: string } | null) {
  return !!e && (e.code === '42P01' || e.code === 'PGRST205' || /time_punches/.test(e.message ?? ''));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function latestPunch(admin: any, userId: string) {
  return admin.from('time_punches').select(COLS)
    .eq('user_id', userId).order('punched_at', { ascending: false }).limit(1).maybeSingle();
}

/** GET ?from=<ISO> — my punches since `from` (default 7 days, at most 62) + my current status. */
export async function GET(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const now = Date.now();
  const fromParam = Date.parse(req.nextUrl.searchParams.get('from') ?? '');
  const from = Number.isFinite(fromParam) ? Math.max(fromParam, now - MAX_RANGE_MS) : now - 7 * 24 * 3600 * 1000;

  const [lastRes, listRes] = await Promise.all([
    latestPunch(admin, user.id),
    admin.from('time_punches').select(COLS)
      .eq('user_id', user.id).gte('punched_at', new Date(from).toISOString())
      .order('punched_at', { ascending: true }).limit(500),
  ]);
  if (tableMissing(lastRes.error) || tableMissing(listRes.error))
    return NextResponse.json({ error: MISSING_TABLE }, { status: 503 });
  if (lastRes.error || listRes.error)
    return NextResponse.json({ error: 'Could not load your shift. Try again.' }, { status: 500 });

  return NextResponse.json({
    status: statusAfter(lastRes.data?.kind ?? null),
    last: lastRes.data ?? null,
    punches: listRes.data ?? [],
  });
}

/** POST { kind, site?, lat?, lng?, accuracy_m?, note? } — one punch, only in a valid order. */
export async function POST(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const b = await req.json().catch(() => null) as Record<string, unknown> | null;
  const kind = b?.kind as TimePunchKind;
  if (!b || !KINDS.includes(kind)) return NextResponse.json({ error: 'kind must be in, break_start, break_end or out' }, { status: 400 });

  const num = (k: string) => (typeof b[k] === 'number' && Number.isFinite(b[k]) ? b[k] as number : null);
  const text = (k: string, max: number) => (typeof b[k] === 'string' ? (b[k] as string).trim().slice(0, max) || null : null);
  const lat = num('lat'), lng = num('lng');
  if ((lat !== null && Math.abs(lat) > 90) || (lng !== null && Math.abs(lng) > 180))
    return NextResponse.json({ error: 'Invalid location' }, { status: 400 });

  const last = await latestPunch(admin, user.id);
  if (tableMissing(last.error)) return NextResponse.json({ error: MISSING_TABLE }, { status: 503 });
  if (last.error) return NextResponse.json({ error: 'Could not read your shift. Try again.' }, { status: 500 });
  // A repeated tap (or a stale screen) can't double-punch: the order is checked against the DB.
  if (!punchAllowed(last.data?.kind ?? null, kind))
    return NextResponse.json({ error: 'Your shift already changed — refresh.', status: statusAfter(last.data?.kind ?? null) }, { status: 409 });

  // No audit_log row: this append-only table is itself the record of every press.
  const { data, error } = await admin.from('time_punches').insert({
    user_id: user.id, kind,
    site: text('site', 120), note: text('note', 500),
    lat, lng, accuracy_m: num('accuracy_m'),
  }).select(COLS).single();
  if (error) return NextResponse.json({ error: 'Could not save the punch. Try again.' }, { status: 500 });

  return NextResponse.json({ punch: data, status: statusAfter(kind) });
}
