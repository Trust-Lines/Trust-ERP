import { requirePage } from '@/lib/permissions/requirePage';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadPortfolio } from '@/lib/workspace/portfolio';
import { PHASE_LABELS } from '@/lib/lifecycle/projectLifecycle';
import { PmWorkspaceClient } from '@/components/platform/workspace/PmWorkspaceClient';
import { toRows } from '@/lib/workspace/rows';
import type { UserRole } from '@/types/database';

export default async function PmWorkspacePage() {
  await requirePage('page.pm');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: me } = await admin.from('profiles').select('role').eq('id', user!.id).maybeSingle();
  const role = (me?.role ?? null) as UserRole | null;

  const seesAll = role === 'ops_manager' || role === 'general_manager';
  const viewer = { userId: user!.id, role };
  const entries = await loadPortfolio(admin, viewer, seesAll ? {} : { pmOf: user!.id });

  const rows = toRows(entries, PHASE_LABELS);
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
      <PmWorkspaceClient rows={rows} seesAll={seesAll} />
    </div>
  );
}
