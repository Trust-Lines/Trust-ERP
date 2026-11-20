import { redirect } from 'next/navigation';
import { requirePage } from '@/lib/permissions/requirePage';
import { getVerifiedUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tableMissing } from '@/lib/hr/requests';
import { teamOf } from '@/lib/hr/team';
import { DEFAULT_TZ, localDay } from '@/lib/hr/reports';
import { HrRequestsClient } from '@/components/platform/hr/HrRequestsClient';
import type { HrPunchKind, HrRequestPriority, HrRequestReason, HrSavedRequest } from '@/components/platform/hr/types';

// Figma "Requests" (node 565:15743). The same hr_requests the mobile app writes (migration 145):
// my own requests plus those of the people I manage (lib/hr/team — direct reports, or everyone
// for ops / GM). Read with the service-role client after that scope is worked out; deciding and
// cancelling go through PATCH /api/hr/requests/:id, which re-checks it.

interface Row {
  id: string; user_id: string | null; kind: 'leave' | 'correction'; reason: string | null;
  start_date: string | null; end_date: string | null; correction_kind: HrPunchKind | null; correction_at: string | null;
  priority: HrRequestPriority; description: string | null; status: HrSavedRequest['status'];
  decision_note: string | null; decided_by: string | null; decided_at: string | null; created_at: string;
}
interface Person { id: string; full_name: string | null; role: string | null; created_at: string | null }

const COLS = 'id, user_id, kind, reason, start_date, end_date, correction_kind, correction_at, priority, description, status, decision_note, decided_by, decided_at, created_at';

export default async function HrRequestsPage() {
  await requirePage('page.team');
  const user = await getVerifiedUser();
  if (!user) redirect('/login');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const team = await teamOf(admin, { id: user.id, role: me?.role ?? null });
  const teamIds = new Set(team.map(t => t.id));
  const ids = [user.id, ...teamIds];

  const { data, error } = await admin.from('hr_requests').select(COLS)
    .in('user_id', ids).order('created_at', { ascending: false }).limit(500);
  const missing = tableMissing(error, 'hr_requests');
  const rows = (error ? [] : data ?? []) as Row[];

  const personIds = [...new Set(rows.flatMap(r => [r.user_id, r.decided_by]).filter((x): x is string => !!x))];
  const { data: ppl } = personIds.length
    ? await admin.from('profiles').select('id, full_name, role, created_at').in('id', personIds)
    : { data: [] };
  const people = new Map(((ppl ?? []) as Person[]).map(p => [p.id, p]));

  const requests: HrSavedRequest[] = rows.map(r => {
    const p = r.user_id ? people.get(r.user_id) : undefined;
    const correction = r.kind === 'correction' && r.correction_kind && r.correction_at
      ? { kind: r.correction_kind, at: r.correction_at } : null;
    const day = correction ? localDay(correction.at, DEFAULT_TZ) : null;
    return {
      id: r.id,
      userId: r.user_id,
      name: p?.full_name || 'Unknown',
      role: p?.role ?? null, // raw role; the client labels it (roleLabel lives in a client module)
      joinedAt: p?.created_at ?? null,
      reason: (r.kind === 'correction' ? 'correction' : r.reason ?? 'vacation') as HrRequestReason,
      priority: r.priority,
      date: day ?? r.start_date ?? r.created_at.slice(0, 10),
      endDate: day ?? r.end_date ?? r.start_date ?? r.created_at.slice(0, 10),
      description: r.description,
      files: [],
      status: r.status,
      decisionNote: r.decision_note,
      decidedAt: r.decided_at,
      decidedByName: r.decided_by ? people.get(r.decided_by)?.full_name ?? null : null,
      createdAt: r.created_at,
      correction,
      mine: r.user_id === user.id,
      canDecide: !!r.user_id && r.user_id !== user.id && teamIds.has(r.user_id),
    };
  });

  return (
    <HrRequestsClient
      requests={requests}
      hasTeam={teamIds.size > 0}
      error={missing ? 'HR is not set up yet — run migration 145_hr_and_warehouse.sql in Supabase.' : error ? 'Could not load requests. Refresh to try again.' : null}
    />
  );
}
