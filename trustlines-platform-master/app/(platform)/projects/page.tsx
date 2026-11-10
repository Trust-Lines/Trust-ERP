import Link from 'next/link';
import { ChevronRight, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProjectsTableClient } from '@/components/platform/projects/ProjectsTableClient';
import { loadPortfolio } from '@/lib/workspace/portfolio';
import { loadLiveContext, withLiveStatus } from '@/lib/workspace/live';
import { PHASE_LABELS } from '@/lib/lifecycle/projectLifecycle';
import { toRows } from '@/lib/workspace/rows';
import type { UserRole } from '@/types/database';
import { loadTrustProjects } from '@/lib/trust/board';
import { projectNumber } from '@/lib/keyClients/match';
import { addressFromName, brandFromDropboxPath, trustRowInfo, type TrustRowInfo } from '@/lib/projects/listInfo';

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
  // Phase, blockers and dates from the Trust System / installation plan (lib/workspace/live).
  const portfolioRows = withLiveStatus(toRows(portfolioEntries, PHASE_LABELS), await loadLiveContext(admin));
  const maxPriority = (r: (typeof portfolioRows)[number]) => Math.max(0, ...r.myActions.map(a => a.priority));
  portfolioRows.sort((a, b) => maxPriority(b) - maxPriority(a) || b.blockers.length - a.blockers.length || (a.code ?? '').localeCompare(b.code ?? ''));
  const waitingOnMe = portfolioRows.filter(r => r.myActions.length > 0);
  const blockedRows = portfolioRows.filter(r => r.myActions.length === 0 && r.blockers.length > 0);

  const { data: rows, error: rowsError } = await supabase
    .from('projects')
    .select('id, code, name, current_stage, categories, deal_value, currency, margin_target_pct, est_delivery_date, client_id, trustlines_pm_id, region, site_location, customer_id, dropbox_root_path')
    .neq('is_archived', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (rowsError) console.error('[projects] query error:', rowsError);

  const projectList = (rows ?? []) as {
    id: string; code: string; name: string; current_stage: string;
    categories: string[]; deal_value: number | null; currency: string;
    margin_target_pct: number | null; est_delivery_date: string | null;
    client_id: string | null; trustlines_pm_id: string | null;
    region: string | null; site_location: string | null; customer_id: string | null; dropbox_root_path: string | null;
  }[];

  const today = new Date().toISOString().split('T')[0];

  // The Trust System's view of each project, by its number (lib/projects/listInfo) — stage,
  // per-type status, ETD — and the dashboard's "Assign to" for that stage as the owner when the
  // project has no PM set. Read-only.
  const trust = await loadTrustProjects();
  const trustByNo = new Map(trust.projects.map(p => [p.projectNo, p]));
  const trustOf = (code: string) => { const no = projectNumber(code); return no ? trustByNo.get(no) ?? null : null; };
  const trustInfo = new Map(projectList.map(p => { const t = trustOf(p.code); return [p.id, t ? { project: t, info: trustRowInfo(t, today) } : null]; }));
  const assignKeys = [...trustInfo.values()].filter(Boolean).map(t => t!.project.id);
  const { data: assignRows } = assignKeys.length
    ? await admin.from('board_assignees').select('item_id, stage, user_id').eq('item_kind', 'trust').in('item_id', assignKeys)
    : { data: [] };
  const assigneeOf = new Map(((assignRows ?? []) as { item_id: string; stage: string; user_id: string }[]).map(a => [`${a.item_id}:${a.stage}`, a.user_id]));
  const assignedId = (projectId: string) => { const t = trustInfo.get(projectId); return t ? assigneeOf.get(`${t.project.id}:${t.info.stage}`) ?? null : null; };

  const customerIds = [...new Set(projectList.map(p => p.customer_id).filter(Boolean))] as string[];
  const pmIds = [...new Set([...projectList.map(p => p.trustlines_pm_id), ...projectList.map(p => assignedId(p.id))].filter(Boolean))] as string[];

  const [customersRes, profilesRes] = await Promise.all([
    customerIds.length > 0
      ? admin.from('customers').select('id, name').in('id', customerIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    pmIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', pmIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const customerMap = new Map(((customersRes.data ?? []) as { id: string; name: string }[]).map(c => [c.id, c.name]));
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
    // The client: its customer record, else the brand folder its Dropbox folder sits in.
    client: (() => { const n = (r.customer_id && customerMap.get(r.customer_id)) || brandFromDropboxPath(r.dropbox_root_path); return n ? { name: n } : null; })(),
    owner: (() => { const id = r.trustlines_pm_id ?? assignedId(r.id); return id ? (ownerMap.get(id) ?? null) : null; })(),
    ownerFromBoard: !r.trustlines_pm_id && !!assignedId(r.id),
    region: r.region,
    address: r.site_location || addressFromName(r.name, r.code),
    trust: trustInfo.get(r.id)?.info ?? null,
  }));

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
  /** The owner is the dashboard card's "Assign to" (no PM set on the project). */
  ownerFromBoard: boolean;
  region: string | null;
  address: string;
  /** The Trust System's stage / types / ETD for this project's number, when it's there. */
  trust: TrustRowInfo | null;
}
