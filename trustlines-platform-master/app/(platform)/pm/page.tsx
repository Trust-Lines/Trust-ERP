import { requirePage } from '@/lib/permissions/requirePage';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadPortfolio } from '@/lib/workspace/portfolio';
import { PHASE_LABELS } from '@/lib/lifecycle/projectLifecycle';
import { PmWorkspaceClient } from '@/components/platform/workspace/PmWorkspaceClient';
import { toRows } from '@/lib/workspace/rows';
import { isOnProject, loadLiveContext, withLiveStatus } from '@/lib/workspace/live';
import type { UserRole } from '@/types/database';

export default async function PmWorkspacePage() {
  await requirePage('page.pm');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: me } = await admin.from('profiles').select('role, full_name').eq('id', user!.id).maybeSingle();
  const role = (me?.role ?? null) as UserRole | null;

  const seesAll = role === 'ops_manager' || role === 'general_manager';
  const viewer = { userId: user!.id, role };
  const [allEntries, live] = await Promise.all([loadPortfolio(admin, viewer), loadLiveContext(admin)]);

  // "My projects": named on the project itself (PM columns), on the T-Lines PM board (Trust PM /
  // T-Lines PM pick) or as the installation's PM — so nobody has to keep a separate list in sync.
  const uid = user!.id;
  const entries = seesAll ? allEntries : allEntries.filter(e => {
    const p = e.project;
    return [p.tlines_pm_id, p.trustlines_pm_id, p.pm_supervisor_id, p.prod_pm_ms_id, p.prod_pm_ci_id].includes(uid)
      || isOnProject(p.code, uid, me?.full_name ?? null, live);
  });

  // Phase, blockers and dates from where the work happens (Trust System, installation plan).
  const rows = withLiveStatus(toRows(entries, PHASE_LABELS), live);
  // Roadmap Month 2, task 17 — "kişi-bazlı günlük öncelik listesi": nextActions.ts already
  // assigns each action a real urgency (a stalled handover outranks a missing designer), but that
  // priority number was being dropped before it ever reached this sort — every project with ANY
  // action tied for first place, ordered only by blocker count then alphabetically. A PM's
  // genuinely most urgent project could sit anywhere in the "waiting on me" list. Now sorted by
  // the highest-priority action on each project first.
  const maxPriority = (r: (typeof rows)[number]) => Math.max(0, ...r.myActions.map(a => a.priority));
  rows.sort((a, b) =>
    maxPriority(b) - maxPriority(a)
    || b.blockers.length - a.blockers.length
    || (a.code ?? '').localeCompare(b.code ?? ''));

  return (
    <div className="main-inner">
      {live.trustError && (
        <p role="status" className="mb-3 rounded-[8px] px-3 py-2 text-[13px] font-medium" style={{ background: 'var(--status-t0-bg)', color: 'var(--status-t0-fg)' }}>
          Trust System couldn’t be read — stages fall back to this app’s own records: {live.trustError}
        </p>
      )}
      <PmWorkspaceClient rows={rows} seesAll={seesAll} />
    </div>
  );
}
