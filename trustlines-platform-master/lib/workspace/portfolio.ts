
import {
  deriveLifecycle, redactLifecycleForRole, canSeeInternalSupply,
  type LifecycleResult, type LifecycleItem, type LifecycleBlocker,
} from '@/lib/lifecycle/projectLifecycle';
import { nextActions, type NextAction, type ActionOwner } from '@/lib/lifecycle/nextActions';

export interface PortfolioProject {
  id: string;
  code: string | null;
  name: string | null;
  is_draft: boolean;
  delivered_to_trust_at: string | null;
  current_stage: string | null;
  customer_id: string | null;
  tlines_pm_id: string | null;
  trustlines_pm_id: string | null;
  pm_supervisor_id: string | null;
  prod_pm_ms_id: string | null;
  prod_pm_ci_id: string | null;
}

export interface PortfolioSources {
  projects: PortfolioProject[];
  designJobsByProject: Map<string, { status: string }[]>;
  handoverByProject: Map<string, { status: string }>;
  siteByProject: Map<string, { overall_status: string }>;
  changeRequestsByProject: Map<string, { status: string }[]>;
  itemsByProject: Map<string, LifecycleItem[]>;
  approvalsByProject: Map<string, { doc_type: string | null }[]>;
  planByProject: Map<string, { status: string; customer_accepted?: boolean }>;
  followUpsByProject: Map<string, { status: string; due_date: string }[]>;
  now?: string;
}

export interface PortfolioEntry {
  project: PortfolioProject;
  lifecycle: LifecycleResult;
  blockers: LifecycleBlocker[];
  myActions: NextAction[];
  allActions: NextAction[];
  pending: { openApprovals: number; openChangeRequests: number; overdueFollowUps: number };
}

export interface Viewer {
  userId: string | null;
  role: string | null | undefined;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export function isMyAction(owner: ActionOwner, project: PortfolioProject, viewer: Viewer): boolean {
  if (owner.kind === 'project_pm') {
    if (!viewer.userId) return false;
    return project[owner.slot] === viewer.userId;
  }
  return !!viewer.role && owner.role === viewer.role;
}

export function assemblePortfolio(
  src: PortfolioSources,
  viewer: Viewer,
): PortfolioEntry[] {
  const today = src.now ?? todayIso();
  const role = viewer.role;

  return src.projects.map((project) => {
    const raw = deriveLifecycle({
      project: {
        id: project.id,
        is_draft: project.is_draft,
        delivered_to_trust_at: project.delivered_to_trust_at,
        current_stage: project.current_stage,
      },
      designJobs: src.designJobsByProject.get(project.id) ?? [],
      handover: src.handoverByProject.get(project.id) ?? null,
      siteReadiness: src.siteByProject.get(project.id) ?? null,
      changeRequests: src.changeRequestsByProject.get(project.id) ?? [],
      items: src.itemsByProject.get(project.id) ?? [],
      pendingApprovals: src.approvalsByProject.get(project.id) ?? [],
      deliveryPlan: src.planByProject.get(project.id) ?? null,
      now: today,
    });

    const lifecycle = redactLifecycleForRole(raw, role);
    const allActions = nextActions(lifecycle, project.id);
    const myActions = allActions.filter(a => isMyAction(a.owner, project, viewer));

    const crs = src.changeRequestsByProject.get(project.id) ?? [];
    const fus = src.followUpsByProject.get(project.id) ?? [];

    return {
      project,
      lifecycle,
      blockers: lifecycle.blockers,
      myActions,
      allActions,
      pending: {
        openApprovals: (src.approvalsByProject.get(project.id) ?? []).length,
        openChangeRequests: crs.filter(c => c.status === 'open' || c.status === 'under_review').length,
        overdueFollowUps: fus.filter(f => f.status === 'open' && f.due_date < today).length,
      },
    };
  });
}

export function blockerRollup(entries: PortfolioEntry[]): { code: string; message: string; projects: number }[] {
  const byCode = new Map<string, { message: string; projects: number }>();
  for (const e of entries) {
    const seen = new Set<string>();
    for (const b of e.blockers) {
      if (b.code === 'stage_mismatch') continue;
      if (seen.has(b.code)) continue;
      seen.add(b.code);
      const hit = byCode.get(b.code);
      if (hit) hit.projects += 1;
      else byCode.set(b.code, { message: b.message, projects: 1 });
    }
  }
  return [...byCode.entries()]
    .map(([code, v]) => ({ code, message: v.message, projects: v.projects }))
    .sort((a, b) => b.projects - a.projects || a.code.localeCompare(b.code));
}

export function workload(entries: PortfolioEntry[]): { userId: string; projects: number; blocked: number }[] {
  const by = new Map<string, { projects: number; blocked: number }>();
  const add = (id: string | null, blocked: boolean) => {
    if (!id) return;
    const hit = by.get(id) ?? { projects: 0, blocked: 0 };
    hit.projects += 1;
    if (blocked) hit.blocked += 1;
    by.set(id, hit);
  };
  for (const e of entries) {
    const blocked = e.blockers.some(b => b.code !== 'stage_mismatch');
    const ids = new Set([e.project.tlines_pm_id, e.project.trustlines_pm_id, e.project.pm_supervisor_id].filter(Boolean) as string[]);
    for (const id of ids) add(id, blocked);
  }
  return [...by.entries()]
    .map(([userId, v]) => ({ userId, ...v }))
    .sort((a, b) => b.blocked - a.blocked || b.projects - a.projects);
}

const PROJECT_COLS =
  'id, code, name, is_draft, delivered_to_trust_at, current_stage, customer_id, tlines_pm_id, trustlines_pm_id, '
  + 'pm_supervisor_id, prod_pm_ms_id, prod_pm_ci_id';

export interface LoadPortfolioOpts {
  pmOf?: string;
  limit?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadPortfolio(admin: any, viewer: Viewer, opts: LoadPortfolioOpts = {}): Promise<PortfolioEntry[]> {
  const limit = opts.limit ?? 200;

  let q = admin.from('projects').select(PROJECT_COLS)
    .is('deleted_at', null).eq('is_draft', false).limit(limit);
  if (opts.pmOf) {
    // 🔴 FIX (Roadmap Month 2, tasks 15/16 — Supply workspace): this OR-filter, the ONLY way
    // "my projects" scoping works in this whole portfolio layer, never included prod_pm_ms_id /
    // prod_pm_ci_id — the Millwork/Shelving and Ceiling/Image PRODUCTION PM columns
    // (CURRENT_SYSTEM_STATE.md §9). A pm_millwork/pm_ceiling person calling loadPortfolio with
    // their own id would see ZERO projects even when genuinely assigned as the production PM,
    // because those two columns were never selected OR checked. tlines_pm/trustlines_pm/
    // pm_supervisor worked; production PMs silently did not.
    q = q.or(`tlines_pm_id.eq.${opts.pmOf},trustlines_pm_id.eq.${opts.pmOf},pm_supervisor_id.eq.${opts.pmOf},`
      + `prod_pm_ms_id.eq.${opts.pmOf},prod_pm_ci_id.eq.${opts.pmOf}`);
  }
  const projectsRes = await q;
  const projects = (projectsRes.error ? [] : (projectsRes.data ?? [])) as PortfolioProject[];
  if (projects.length === 0) return [];

  const ids = projects.map(p => p.id);

  const [leadsRes, designRes, handoverRes, siteRes, crRes, itemsRes, apprRes, planRes, fuRes] = await Promise.all([
    admin.from('lead_intake').select('id, project_id').in('project_id', ids).limit(limit * 2),
    Promise.resolve(null),
    admin.from('project_handovers').select('project_id, status').in('project_id', ids).limit(limit),
    admin.from('site_readiness').select('project_id, overall_status').in('project_id', ids).limit(limit),
    admin.from('change_requests').select('project_id, status').in('project_id', ids).is('deleted_at', null).limit(limit * 10),
    admin.from('production_items')
      .select('id, project_id, type, status, vendor_id, po_sign_status, pf_sign_status, target_date')
      .in('project_id', ids).eq('source', 'project').is('deleted_at', null).limit(limit * 10),
    admin.from('document_approvals').select('project_id, doc_type, status')
      .in('project_id', ids).eq('status', 'pending').limit(limit * 10),
    admin.from('delivery_plans').select('project_id, status, customer_accepted').in('project_id', ids).limit(limit),
    admin.from('customer_follow_ups').select('project_id, status, due_date')
      .in('project_id', ids).is('deleted_at', null).limit(limit * 10),
  ]);
  void designRes;

  const rows = <T,>(r: { data: T[] | null; error?: unknown } | null): T[] =>
    (r && !(r as { error?: unknown }).error && Array.isArray((r as { data: unknown }).data))
      ? ((r as { data: T[] }).data ?? []) : [];

  const leads = rows<{ id: string; project_id: string }>(leadsRes);
  const leadToProject = new Map(leads.map(l => [l.id, l.project_id]));
  let designJobs: { lead_intake_id: string; status: string }[] = [];
  if (leads.length) {
    const jobsRes = await admin.from('sales_design_jobs')
      .select('lead_intake_id, status').in('lead_intake_id', leads.map(l => l.id))
      .is('deleted_at', null).limit(limit * 5);
    designJobs = rows<{ lead_intake_id: string; status: string }>(jobsRes);
  }

  const group = <T extends { project_id: string }>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of list) {
      const arr = m.get(r.project_id) ?? [];
      arr.push(r);
      m.set(r.project_id, arr);
    }
    return m;
  };
  const first = <T extends { project_id: string }>(list: T[]) => {
    const m = new Map<string, T>();
    for (const r of list) if (!m.has(r.project_id)) m.set(r.project_id, r);
    return m;
  };

  const designByProject = new Map<string, { status: string }[]>();
  for (const j of designJobs) {
    const pid = leadToProject.get(j.lead_intake_id);
    if (!pid) continue;
    const arr = designByProject.get(pid) ?? [];
    arr.push({ status: j.status });
    designByProject.set(pid, arr);
  }

  const itemRows = rows<{ id: string; project_id: string; type: string; status: string; vendor_id: string | null; po_sign_status: string; pf_sign_status: string; target_date: string | null }>(itemsRes);
  const itemsByProject = new Map<string, LifecycleItem[]>();
  for (const i of itemRows) {
    const arr = itemsByProject.get(i.project_id) ?? [];
    arr.push({
      id: i.id, type: i.type, status: i.status,
      hasVendor: !!i.vendor_id,
      poSignStatus: i.po_sign_status, pfSignStatus: i.pf_sign_status,
      targetDate: i.target_date,
    });
    itemsByProject.set(i.project_id, arr);
  }

  return assemblePortfolio({
    projects,
    designJobsByProject: designByProject,
    handoverByProject: first(rows<{ project_id: string; status: string }>(handoverRes)),
    siteByProject: first(rows<{ project_id: string; overall_status: string }>(siteRes)),
    changeRequestsByProject: group(rows<{ project_id: string; status: string }>(crRes)),
    itemsByProject,
    approvalsByProject: group(rows<{ project_id: string; doc_type: string | null }>(apprRes)),
    planByProject: first(rows<{ project_id: string; status: string; customer_accepted?: boolean }>(planRes)),
    followUpsByProject: group(rows<{ project_id: string; status: string; due_date: string }>(fuRes)),
  }, viewer);
}

export { canSeeInternalSupply };
