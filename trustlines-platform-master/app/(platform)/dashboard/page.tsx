import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect as nextRedirect } from 'next/navigation';
import { REGIONS } from '@/lib/regions';
import { fetchInChunks } from '@/lib/supabase/chunkedIn';
import { regionLogoByCode } from '@/lib/regionLogo';
import { getAssignedRegions, regionAllows } from '@/lib/access/regionScope';
import { MARKETING_ROLES } from '@/lib/marketing/roles';
import { SALES_HANDOFF_ROLES, SALES_INTAKE_ROLES } from '@/lib/sales/roles';
import { loadClientOpportunities, type ClientOpportunityRow } from '@/lib/keyClients/server';
import { quickViewLink } from '@/lib/marketing/quickViewLink';
import { BranchBoard, type BoardColumn, type BoardSection, type BoardCardItem } from '@/components/platform/dashboard/BranchBoard';
import { TopSummaryRow, type ApprovalSummaryItem, type KpiItem } from '@/components/platform/dashboard/TopSummaryRow';

// Same set /marketing/opportunities uses to gate its own quick-view edits — reused here so
// the popup opened from the dashboard board follows the exact same edit rule, not a new one.
const OPPORTUNITY_EDIT_ROLES = [...SALES_HANDOFF_ROLES, ...MARKETING_ROLES];

// Design: Figma "Tlines-Websites" → "Desktop - 17" (node 60:1139). Replaced the old
// company-wide dashboard entirely — that page (temporarily kept at /old-dashboard for
// comparison) has since been deleted; this is the only dashboard now.
//
// Column = real T-Lines region (lib/regions.ts). Visibility reuses the existing region-scope
// rule (lib/access/regionScope.ts, already live for marketing_pr/sales_rep on Opportunities):
// an account with assigned_regions = [] sees every column; one with specific regions set sees
// only those — "bazıları belirli bölümleri görür, bazıları hepsini" from a single, already-
// audited rule, not a new permission.
//
// Row mapping — projects.current_stage only has 5 values (migration 007), fewer than the
// design's 7 rows. Best-effort mapping below; "To Production" and "Shipped" have no
// distinguishing signal in the data model yet and are always empty until that's defined.
// Colours: Figma "ops_manager" stage variables in globals.css (node 376:32191, dark 384:41126).
const SECTION_DEFS = [
  { key: 'opportunity',   label: 'Clients Opportunity',    accent: 'var(--stage-opportunity-fg)', bg: 'var(--stage-opportunity-bg)' },
  { key: 'finalization',  label: 'Finalization',           accent: 'var(--stage-finalization-fg)', bg: 'var(--stage-finalization-bg)', labelColor: 'var(--stage-finalization-label)' },
  { key: 'technical',     label: 'Technical / PO + PF',    accent: 'var(--stage-technical-fg)', bg: 'var(--stage-technical-bg)' },
  { key: 'to_production', label: 'To Production',          accent: 'var(--stage-to-production-fg)', bg: 'var(--stage-to-production-bg)' },
  { key: 'in_production', label: 'Production In Progress', accent: 'var(--stage-production-fg)', bg: 'var(--stage-production-bg)' },
  { key: 'shipped',       label: 'Shipped',                accent: 'var(--stage-shipped-fg)', bg: 'var(--stage-shipped-bg)' },
  { key: 'ready',         label: 'Ready For Installation', accent: 'var(--stage-ready-fg)', bg: 'var(--stage-ready-bg)' },
] as const;

const HEADER_COLORS: Record<string, string> = {
  TLINES_NE: '#465B6D',
  TLINES_SE: '#3B472B',
  TLINES_NW: '#2E5BA3',
  CVW:       '#7A655E',
};

function categoryLabel(values: string[] | null | undefined): string | null {
  return values?.map(v => v.replace(/_/g, ' ')).join(', ') || null;
}

function fmtDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const [y, m, day] = d.split('-');
  return y && m && day ? `${m}/${day}/${y}` : d;
}

function projectBadge(code: string): [string, string] {
  const i = code.lastIndexOf(' ');
  return i === -1 ? [code, ''] : [code.slice(0, i), `#${code.slice(i + 1)}`];
}

// Opportunities don't get our own `projects.code` until Sales hands them off (they don't have
// a project yet) — but ClickUp's own "PROJECT #" field (e.g. "417-NE") was already captured
// per-row as external_project_code (migration 104). Use that; only fall back to a plain "OP"
// tag for rows imported before that backfill ran.
function opportunityBadge(externalProjectCode: string | null): [string, string] {
  if (!externalProjectCode) return ['OP', ''];
  const i = externalProjectCode.lastIndexOf('-');
  return i === -1 ? [externalProjectCode, ''] : [externalProjectCode.slice(0, i), externalProjectCode.slice(i + 1)];
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) nextRedirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: profileData } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();
  const profile = profileData as { role: string | null; full_name: string | null } | null;
  const userRole = profile?.role ?? 'ops_manager';

  // Same T-Lines-side boundary as the old dashboard (AGENTS.md §2) — send marketing accounts
  // to their own scoped landing page instead of the branch board.
  if (userRole === 'marketing_pr' || userRole === 'marketing_manager') {
    nextRedirect('/marketing');
  }

  const assignedRegions = await getAssignedRegions(admin, user.id);
  const visibleRegions = REGIONS.filter(r => regionAllows(assignedRegions, r.code));
  const regionCodes = visibleRegions.map(r => r.code);

  // Projects are read through the user's own RLS session — the same visibility as
  // /projects and /projects/[id] — so the board never lists a project the user cannot
  // open. tlines_pm additionally sees only projects they are assigned to.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let projectQuery = (supabase as any).from('projects')
    .select('id, code, name, current_stage, region, site_location, est_delivery_date, closed_deal_date, created_at, categories, tlines_pm_id')
    .in('region', regionCodes)
    .is('deleted_at', null)
    .neq('is_archived', true)
    .eq('is_draft', false);
  if (userRole === 'tlines_pm') projectQuery = projectQuery.eq('tlines_pm_id', user.id);

  // "Clients Opportunity" is not every deal: only the open Opportunities/Potentials of our key
  // clients (key_clients, migration 134 — lib/keyClients/server.ts). Trust follows those before
  // they're signed; everything else waits until it's a project.
  const loadClientOpps = async (): Promise<ClientOpportunityRow[]> => {
    try {
      const r = await loadClientOpportunities(admin);
      return Object.values(r.regions).flat().filter(o => !!o.region && regionCodes.includes(o.region));
    } catch (e) {
      console.error('[dashboard] client opportunities unavailable (migration 134?):', e instanceof Error ? e.message : e);
      return [];
    }
  };
  const [{ data: projectRows }, opportunities] = regionCodes.length === 0
    ? [{ data: [] }, [] as ClientOpportunityRow[]]
    : await Promise.all([projectQuery, loadClientOpps()]);

  type ProjectRow = {
    id: string; code: string; name: string; current_stage: string; region: string | null;
    site_location: string | null; est_delivery_date: string | null; closed_deal_date: string | null;
    created_at: string; categories: string[] | null; tlines_pm_id: string | null;
  };

  const projects = (projectRows ?? []) as ProjectRow[];

  const pmIds = [...new Set([
    ...projects.map(p => p.tlines_pm_id),
    ...opportunities.map(o => o.ownerId),
  ].filter(Boolean))] as string[];
  const prospectIds = [...new Set(opportunities.map(o => o.prospectId))];
  const [pmRows, locationRows, holdRows] = await Promise.all([
    fetchInChunks(pmIds, chunk => admin.from('profiles').select('id, full_name').in('id', chunk)),
    fetchInChunks(prospectIds, chunk => admin.from('prospect_locations').select('prospect_id, city, state').in('prospect_id', chunk).order('created_at', { ascending: true })),
    // A project is "On Hold" when one of its types is: same HOLD statuses as lib/dashboard/myDay.ts.
    fetchInChunks(projects.map(p => p.id), chunk => admin.from('production_items')
      .select('project_id').eq('source', 'project').in('status', ['HOLD_T', 'HOLD_PM']).is('deleted_at', null).in('project_id', chunk)),
  ]) as [
    { id: string; full_name: string }[],
    { prospect_id: string; city: string | null; state: string | null }[],
    { project_id: string }[],
  ];
  const pmNames = new Map(pmRows.map(p => [p.id, p.full_name]));
  const heldProjects = new Set(holdRows.map(h => h.project_id));
  const prospectPlace = new Map<string, string>();
  for (const l of locationRows) {
    const place = [l.city, l.state].filter(Boolean).join(', ');
    if (place && !prospectPlace.has(l.prospect_id)) prospectPlace.set(l.prospect_id, place);
  }

  const columns: BoardColumn[] = visibleRegions.map(r => {
    const regionProjects = projects.filter(p => p.region === r.code);
    // Like the PROJECTS PROGRESS sheet: grouped by client (A–Z), newest first within a client.
    const regionOpportunities = opportunities.filter(o => o.region === r.code)
      .sort((a, b) => a.client.localeCompare(b.client) || b.createdAt.localeCompare(a.createdAt));

    const opportunityItems: BoardCardItem[] = regionOpportunities.map(o => {
      // Badge = the sheet's project number ("#507"); deals without one keep their code / "OP".
      const [top, bottom] = o.projectNo ? [`#${o.projectNo}`, ''] : opportunityBadge(o.projectCode);
      // ClickUp's "date created" when imported (when it became an opportunity there), else ours.
      const becameOpportunityDate = o.createdAt.slice(0, 10);
      return {
        id: o.id, kind: 'opportunity',
        badgeTop: top, badgeBottom: bottom,
        title: o.client,
        subtitle: o.site || (prospectPlace.get(o.prospectId) ?? null),
        category: categoryLabel(o.projectTypes.length ? o.projectTypes : o.projectTypeRaw ? [o.projectTypeRaw] : null),
        pmName: o.ownerId ? pmNames.get(o.ownerId) ?? null : null,
        pmLabel: o.ownerIsSales ? 'Sales Owner' : 'Marketing Owner',
        onHold: o.stage === 'on_hold',
        dateISO: becameOpportunityDate,
        dateLabel: fmtDate(becameOpportunityDate),
        href: quickViewLink(o.kind, o.id),
      };
    });

    const toCardItem = (p: ProjectRow): BoardCardItem => {
      const [top, bottom] = projectBadge(p.code);
      const date = p.est_delivery_date ?? p.closed_deal_date;
      return {
        id: p.id, kind: 'project', badgeTop: top, badgeBottom: bottom,
        title: p.name,
        subtitle: p.site_location,
        onHold: heldProjects.has(p.id),
        category: categoryLabel(p.categories),
        pmName: p.tlines_pm_id ? pmNames.get(p.tlines_pm_id) ?? null : null,
        pmLabel: 'T Lines PM',
        dateISO: date,
        dateLabel: fmtDate(date),
        href: `/projects/${p.id}`,
      };
    };

    const finalizationItems = regionProjects.filter(p => p.current_stage === 'closed_deal' || p.current_stage === 'finalization').map(toCardItem);
    const technicalItems    = regionProjects.filter(p => p.current_stage === 'client_approval').map(toCardItem);
    const inProductionItems = regionProjects.filter(p => p.current_stage === 'production').map(toCardItem);
    const readyItems        = regionProjects.filter(p => p.current_stage === 'delivered').map(toCardItem);

    // Newest date first within each section, undated cards pushed to the end (never dropped).
    const byDate = (a: BoardCardItem, b: BoardCardItem) =>
      a.dateISO && b.dateISO ? b.dateISO.localeCompare(a.dateISO) : a.dateISO ? -1 : b.dateISO ? 1 : 0;

    const itemsByKey: Record<string, BoardCardItem[]> = {
      opportunity:   opportunityItems,                     // already in client order
      finalization:  [...finalizationItems].sort(byDate),
      technical:     [...technicalItems].sort(byDate),
      to_production: [],
      in_production: [...inProductionItems].sort(byDate),
      shipped:       [],
      ready:         [...readyItems].sort(byDate),
    };

    const sections: BoardSection[] = SECTION_DEFS.map(def => ({
      key: def.key, label: def.label, accent: def.accent, bg: def.bg, labelColor: 'labelColor' in def ? def.labelColor : undefined,
      items: itemsByKey[def.key],
      emptyLabel: 'No Active Projects',
    }));

    return {
      regionCode: r.code,
      logoSrc: regionLogoByCode(r.dropboxShort),
      logoCode: r.dropboxShort,
      headerColor: HEADER_COLORS[r.code] ?? HEADER_COLORS.TLINES_NE,
      sections,
    };
  });

  const { data: marketingAssignees } = await admin.from('profiles')
    .select('id, full_name')
    .in('role', ['marketing_pr', 'marketing_manager', 'sales_rep', 'sales_marketing_manager', 'ops_manager', 'general_manager'])
    .eq('is_active', true).order('full_name', { ascending: true });

  const canEditOpportunities = OPPORTUNITY_EDIT_ROLES.includes(userRole);

  // ── Active Projects / Approvals summary row ──────────────────────────────────────────
  // Reuses the same `projects` this board already fetched (region- and RLS-scoped) — no second query
  // for the count itself, same "active = not delivered" rule as the old dashboard.
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const active = projects.filter(p => p.current_stage !== 'delivered');
  const activeCount = active.length;
  const overdueCount = active.filter(p => p.est_delivery_date && p.est_delivery_date < today).length;
  const newThisWeek = projects.filter(p => p.created_at >= weekAgo).length;

  const isApprovalsAdmin = ['ops_manager', 'general_manager'].includes(userRole);
  const projectIds = projects.map(p => p.id);
  let approvals: ApprovalSummaryItem[] = [];
  if (projectIds.length > 0) {
    let approvalsQuery = admin.from('document_approvals')
      .select('id, stage, doc_type, assigned_to, created_at, project_id')
      .eq('status', 'pending')
      .in('project_id', projectIds)
      .order('created_at', { ascending: true })
      .limit(20);
    if (!isApprovalsAdmin) approvalsQuery = approvalsQuery.eq('assigned_to', user.id);

    const { data: approvalRows } = await approvalsQuery as { data: {
      id: string; stage: number; doc_type: string; assigned_to: string | null; created_at: string; project_id: string;
    }[] | null };

    const projectMap = new Map(projects.map(p => [p.id, p]));
    approvals = (approvalRows ?? []).map(a => {
      const proj = projectMap.get(a.project_id);
      return {
        id: a.id, projectId: a.project_id,
        projectCode: proj?.code ?? '—', projectName: proj?.name ?? '—',
        docType: a.doc_type, stage: a.stage,
      };
    });
  }

  // Figma's "In Design" has no stage of its own, so it uses client_approval (the Technical row).
  const stageKpi = (key: KpiItem['key'], label: string, stages: string[]): KpiItem => {
    const rows = projects.filter(p => stages.includes(p.current_stage));
    const fresh = rows.filter(p => p.created_at >= weekAgo).length;
    return { key, label, value: rows.length, href: '/projects', badge: fresh > 0 ? `+${fresh} New` : undefined };
  };
  const kpis: KpiItem[] = [
    {
      key: 'active', label: 'Active Projects', value: activeCount, href: '/projects',
      // Overdue is the more urgent signal; fall back to "new this week" when nothing is late.
      badge: overdueCount > 0 ? `${overdueCount} overdue` : newThisWeek > 0 ? `+${newThisWeek} New` : undefined,
    },
    stageKpi('design', 'In Design', ['client_approval']),
    stageKpi('production', 'In Production', ['production']),
    stageKpi('finalizing', 'Finalizing', ['closed_deal', 'finalization']),
    { key: 'approvals', label: 'Approvals', value: approvals.length, href: '/approvals', badge: approvals.length > 0 ? 'Pending' : undefined },
  ];

  return (
    <BranchBoard
      columns={columns}
      assignees={marketingAssignees ?? []}
      canEdit={canEditOpportunities}
      canCreateTask={SALES_INTAKE_ROLES.includes(userRole)}
      top={<TopSummaryRow fullName={profile?.full_name ?? ''} role={userRole} kpis={kpis} />}
    />
  );
}
