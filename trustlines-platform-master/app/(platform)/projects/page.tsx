import Link from 'next/link';
import { ChevronRight, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProjectsTableClient } from '@/components/platform/projects/ProjectsTableClient';
import { loadPortfolio } from '@/lib/workspace/portfolio';
import { PHASE_LABELS } from '@/lib/lifecycle/projectLifecycle';
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

  // Saved views ("All / Waiting on me / Blocked") filter the one table below; the hint is the
  // next action or blocker, shown as the row's sub-line (Figma "Projects · Desktop").
  const viewNotes: Record<string, ProjectViewNote> = {};
  for (const r of waitingOnMe) viewNotes[r.projectId] = { view: 'waiting', hint: r.myActions[0]?.action ?? null };
  for (const r of blockedRows) viewNotes[r.projectId] = { view: 'blocked', hint: r.blockers[0]?.message ?? null };

  const canCreate = userRole === 'ops_manager' || userRole === 'general_manager';

  return (
    <div className="main-inner">
      <nav aria-label="Breadcrumb" className="mb-[18px] flex items-center gap-2 text-[12px] leading-[1.4]">
        <Link href="/projects" className="text-ui-text-secondary no-underline hover:underline">Supply</Link>
        <ChevronRight aria-hidden className="size-3 text-ui-text-secondary" />
        <Link href="/projects" aria-current="page" className="text-ui-body no-underline hover:underline">Projects</Link>
      </nav>
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-[6px]">
          <h1 className="m-0 text-[30px] font-semibold leading-normal text-[var(--color-secondary-700)] dark:text-ui-heading">
            Projects
          </h1>
          <p className="m-0 text-[14px] leading-[1.4] text-ui-text-secondary">
            Track delivery, ownership and next steps across every project.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/projects/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-ui-btn-accent bg-ui-btn-accent px-[14px] text-[13px] font-semibold text-ui-btn-accent-fg no-underline hover:brightness-95"
          >
            <Plus aria-hidden className="size-4" /> New project
          </Link>
        )}
      </div>

      <ProjectsTableClient
        projects={projects}
        userRole={userRole}
        today={today}
        viewNotes={viewNotes}
        canCreate={canCreate}
      />
    </div>
  );
}

export interface ProjectViewNote {
  view: 'waiting' | 'blocked';
  hint: string | null;
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
