import { redirect } from 'next/navigation';
import { requirePage } from '@/lib/permissions/requirePage';
import { getVerifiedUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { HR_ADMIN_ROLES } from '@/lib/hr/requests';
import { teamOf } from '@/lib/hr/team';
import { buildReport, localDay, monthBounds, parseMonth, DEFAULT_TZ, type ReportPerson } from '@/lib/hr/reports';
import { HrReportsPage } from '@/components/platform/hr/HrReportsPage';

// HR → Reports. Ops / GM see everyone; a manager sees the people who report to them (same scope as
// mobile "Ekibim", lib/hr/team). Rows are read with the service-role client after that check.

const PERSON_COLS = 'id, full_name, role, department, office, is_active, created_at';
const PAGE = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function all<T>(build: (from: number, to: number) => any): Promise<{ rows: T[]; missing: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < 50 * PAGE; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) return { rows, missing: error.code === '42P01' || error.code === 'PGRST205' };
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return { rows, missing: false };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requirePage('page.team');
  const user = await getVerifiedUser();
  if (!user) redirect('/login');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const month = parseMonth((await searchParams).month);
  const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const isAdmin = HR_ADMIN_ROLES.includes(me?.role ?? '');

  let people: ReportPerson[];
  if (isAdmin) {
    const { data } = await admin.from('profiles').select(PERSON_COLS).order('full_name').limit(2000);
    people = (data ?? []) as ReportPerson[];
  } else {
    const ids = (await teamOf(admin, { id: user.id, role: me?.role ?? null })).map(t => t.id);
    const { data } = ids.length ? await admin.from('profiles').select(PERSON_COLS).in('id', ids) : { data: [] };
    people = (data ?? []) as ReportPerson[];
  }

  const ids = people.filter(p => p.is_active).map(p => p.id);
  const { first, last } = monthBounds(month);
  // A day of slack each side so office time zones and sessions crossing midnight are covered.
  const fromIso = new Date(Date.parse(`${first}T00:00:00Z`) - 2 * 864e5).toISOString();
  const toIso = new Date(Date.parse(`${last}T00:00:00Z`) + 2 * 864e5).toISOString();
  const yearFirst = `${month.slice(0, 4)}-01-01`;

  const [punches, shifts, leaves] = ids.length ? await Promise.all([
    all<{ user_id: string; kind: never; punched_at: string }>((a, b) => admin.from('time_punches')
      .select('user_id, kind, punched_at').in('user_id', ids)
      .gte('punched_at', fromIso).lt('punched_at', toIso)
      .order('punched_at').order('id').range(a, b)),
    all<{ user_id: string; shift_date: string; start_time: string }>((a, b) => admin.from('hr_shifts')
      .select('user_id, shift_date, start_time').in('user_id', ids)
      .gte('shift_date', first).lte('shift_date', last)
      .order('shift_date').order('id').range(a, b)),
    // Approved leave touching this year up to the month end (for the year's vacation total) and
    // every pending request.
    all<{ user_id: string; reason: string; start_date: string; end_date: string; status: string }>((a, b) => admin.from('hr_requests')
      .select('user_id, reason, start_date, end_date, status').in('user_id', ids)
      .eq('kind', 'leave').in('status', ['approved', 'pending'])
      .lte('start_date', last).gte('end_date', yearFirst)
      .order('start_date').order('id').range(a, b)),
  ]) : [{ rows: [], missing: false }, { rows: [], missing: false }, { rows: [], missing: false }];

  const report = buildReport({
    month,
    today: localDay(new Date().toISOString(), DEFAULT_TZ),
    people,
    punches: punches.rows,
    shifts: shifts.rows,
    leaves: leaves.rows,
  });

  return (
    <HrReportsPage
      report={report}
      scope={isAdmin ? 'all' : 'team'}
      missingTables={punches.missing || shifts.missing || leaves.missing}
    />
  );
}
