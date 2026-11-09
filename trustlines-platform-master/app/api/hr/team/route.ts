import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { statusAfter } from '@/lib/hr/shift';
import { teamOf } from '@/lib/hr/team';

// Mobile "Ekibim" (019 / 067): the people I manage with their shift status right now (latest punch
// in the last 24 h) and pending requests. Empty for someone who manages nobody.
export async function GET() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const team = await teamOf(admin, { id: user.id, role: me?.role ?? null });
  if (!team.length) return NextResponse.json({ people: [] });
  const ids = team.map(t => t.id);

  const since = new Date(Date.now() - 864e5).toISOString();
  const [punches, pending] = await Promise.all([
    admin.from('time_punches').select('user_id, kind, punched_at, site').in('user_id', ids).gte('punched_at', since).order('punched_at', { ascending: false }).limit(5000),
    admin.from('hr_requests').select('user_id').in('user_id', ids).eq('status', 'pending').limit(2000),
  ]);
  const last = new Map<string, { kind: string; punched_at: string; site: string | null }>();
  for (const p of (punches.data ?? []) as { user_id: string; kind: string; punched_at: string; site: string | null }[]) if (!last.has(p.user_id)) last.set(p.user_id, p);
  const pend = new Map<string, number>();
  for (const r of (pending.data ?? []) as { user_id: string }[]) pend.set(r.user_id, (pend.get(r.user_id) ?? 0) + 1);

  return NextResponse.json({
    people: team.map(t => {
      const p = last.get(t.id);
      return { id: t.id, full_name: t.full_name, role: t.role, status: statusAfter((p?.kind ?? null) as never), since: p?.punched_at ?? null, site: p?.site ?? null, pending: pend.get(t.id) ?? 0 };
    }),
  });
}
