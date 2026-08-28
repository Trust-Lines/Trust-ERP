import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProjectsTableClient } from '@/components/platform/projects/ProjectsTableClient';
import { loadPortfolio } from '@/lib/workspace/portfolio';
import { PHASE_LABELS } from '@/lib/lifecycle/projectLifecycle';
import { PortfolioList } from '@/components/platform/workspace/PortfolioClient';
import { toRows } from '@/lib/workspace/rows';
import type { UserRole } from '@/types/database';

// User feedback, 2026-08-28: a separate /supply page next to "All Projects" was one extra
// destination too many — "fazladan sayfa lazım değil, yeterli sayfada lazım." Folded the same
// "waiting on me / blocked / on track" summary (same loadPortfolio engine as /pm) directly INTO
// this page instead of a second route. One Supply destination, richer than before, not two.
const SEES_ALL_SUPPLY_ROLES = ['ops_manager', 'general_manager', 'supply_manager'];

export default async function ProjectsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'ops_manager';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const seesAllSupply = SEES_ALL_SUPPLY_ROLES.includes(userRole);
  const portfolioEntries = await loadPortfolio(
    admin, { userId: user!.id, role: userRole }, seesAllSupply ? {} : { pmOf: user!.id },
  );
  const portfolioRows = toRows(portfolioEntries, PHASE_LABELS);
  const maxPriority = (r: (typeof portfolioRows)[number]) => Math.max(0, ...r.myActions.map(a => a.priority));
  portfolioRows.sort((a, b) => maxPriority(b) - maxPriority(a) || b.blockers.length - a.blockers.length || (a.code ?? '').localeCompare(b.code ?? ''));
  const waitingOnMe = portfolioRows.filter(r => r.myActions.length > 0);
  const blockedRows = portfolioRows.filter(r => r.myActions.length === 0 && r.blockers.length > 0);

  const { data: rows, error: rowsError } = await supabase
    .from('projects')
    .select('id, code, name, current_stage, categories, deal_value, currency, margin_target_pct, est_delivery_date, client_id, trustlines_pm_id')
    .neq('is_archived', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (rowsError) console.error('[projects] query error:', rowsError);

  const projectList = (rows ?? []) as {
    id: string; code: string; name: string; current_stage: string;
    categories: string[]; deal_value: number | null; currency: string;
    margin_target_pct: number | null; est_delivery_date: string | null;
    client_id: string | null; trustlines_pm_id: string | null;
  }[];

  const clientIds = [...new Set(projectList.map(p => p.client_id).filter(Boolean))] as string[];
  const pmIds     = [...new Set(projectList.map(p => p.trustlines_pm_id).filter(Boolean))] as string[];

  const [clientsRes, profilesRes] = await Promise.all([
    clientIds.length > 0
      ? supabase.from('clients').select('id, name').in('id', clientIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    pmIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', pmIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const clientMap = new Map((clientsRes.data ?? []).map(c => [c.id, c]));
  const ownerMap  = new Map((profilesRes.data ?? []).map(p => [p.id, p]));

  const projects: ProjectRow[] = projectList.map(r => ({
    id:               r.id,
    code:             r.code,
    name:             r.name,
    current_stage:    r.current_stage,
    categories:       r.categories,
    deal_value:       r.deal_value,
    currency:         r.currency,
    margin_target_pct: r.margin_target_pct,
    est_delivery_date: r.est_delivery_date,
    client: r.client_id ? (clientMap.get(r.client_id) ?? null) : null,
    owner:  r.trustlines_pm_id ? (ownerMap.get(r.trustlines_pm_id) ?? null) : null,
  }));

  const today = new Date().toISOString().split('T')[0];
  const activeCount  = projects.filter(p => p.current_stage !== 'delivered').length;
  const overdueCount = projects.filter(
    p => p.est_delivery_date && p.est_delivery_date < today && p.current_stage !== 'delivered',
  ).length;

  return (
    <div className="main-inner">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-default)', margin: '0 0 4px' }}>
            Projects
          </h1>
          <p className="page-head-sub">
            {activeCount} active
            {overdueCount > 0 && (
              <span style={{ color: 'var(--status-danger)', marginLeft: 6 }}>
                · {overdueCount} overdue
              </span>
            )}
          </p>
        </div>
        {(userRole === 'ops_manager' || userRole === 'general_manager') && (
          <Link href="/projects/new" className="btn btn-primary">
            + New project
          </Link>
        )}
      </div>

      {waitingOnMe.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--brand-orange)' }}>Waiting on me</h2>
            <span style={{ fontSize: 11.5, color: 'var(--fg-faint)' }}>Your next step — item plan / list / PO / PF, or a handover</span>
          </div>
          <PortfolioList rows={waitingOnMe} emptyLabel="" />
        </section>
      )}
      {blockedRows.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Blocked</h2>
            <span style={{ fontSize: 11.5, color: 'var(--fg-faint)' }}>Someone else's step, but not moving</span>
          </div>
          <PortfolioList rows={blockedRows} emptyLabel="" />
        </section>
      )}

      <ProjectsTableClient projects={projects} userRole={userRole} today={today} />
    </div>
  );
}

export interface ProjectRow {
  id: string;
  code: string;
  name: string;
  current_stage: string;
  categories: string[];
  deal_value: number | null;
  currency: string;
  margin_target_pct: number | null;
  est_delivery_date: string | null;
  client: { name: string } | null;
  owner: { full_name: string } | null;
}
