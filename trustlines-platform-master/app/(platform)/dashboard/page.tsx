import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect as nextRedirect } from 'next/navigation';
import { REGIONS } from '@/lib/regions';
import { regionLogoByCode } from '@/lib/regionLogo';
import { getAssignedRegions, regionAllows } from '@/lib/access/regionScope';
import { MARKETING_ROLES } from '@/lib/marketing/roles';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { BranchBoard, type BoardColumn, type BoardSection, type BoardCardItem } from '@/components/platform/dashboard/BranchBoard';
import { TopSummaryRow, type ApprovalSummaryItem } from '@/components/platform/dashboard/TopSummaryRow';

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
const SECTION_DEFS = [
  { key: 'opportunity',  label: 'Clients Opportunity',    accent: '#3a83f5', bg: '#eaf4ff', badgeBg: '#3a83f5', badgeText: '#eaf4ff' },
  { key: 'finalization', label: 'Finalization',           accent: '#f59e0b', bg: '#fff4e3', badgeBg: '#f59e0b', badgeText: '#fff4e3' },
  { key: 'technical',    label: 'Technical / PO + PF',    accent: '#a855f7', bg: '#f5e9ff', badgeBg: '#a855f7', badgeText: '#f5e9ff' },
  { key: 'to_production',label: 'To Production',          accent: '#0d9488', bg: '#e2eae9', badgeBg: '#0d9488', badgeText: '#e2eae9' },
  { key: 'in_production',label: 'Production In Progress', accent: '#ef4444', bg: '#fcdada', badgeBg: '#ef4444', badgeText: '#fcdada' },
  { key: 'shipped',      label: 'Shipped',                accent: '#10b981', bg: '#e8f9f3', badgeBg: '#10b981', badgeText: '#e8f9f3' },
  { key: 'ready',        label: 'Ready For Installation', accent: '#84cc16', bg: '#effade', badgeBg: '#84cc16', badgeText: '#effade' },
] as const;

const HEADER_COLORS: Record<string, string> = {
  TLINES_NE: '#465b6d',
  TLINES_SE: '#3b472b',
  TLINES_NW: '#2e5ba3',
  CVW:       '#7a655e',
};

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

  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const userRole = (profileData as { role: string | null } | null)?.role ?? 'ops_manager';

  // Same T-Lines-side boundary as the old dashboard (AGENTS.md §2) — send marketing accounts
  // to their own scoped landing page instead of the branch board.
  if (userRole === 'marketing_pr' || userRole === 'marketing_manager') {
    nextRedirect('/marketing');
  }

  const assignedRegions = await getAssignedRegions(admin, user.id);
  const visibleRegions = REGIONS.filter(r => regionAllows(assignedRegions, r.code));
  const regionCodes = visibleRegions.map(r => r.code);

  const [{ data: projectRows }, { data: opportunityRows }] = regionCodes.length === 0
    ? [{ data: [] }, { data: [] }]
    : await Promise.all([
        admin.from('projects')
          .select('id, code, name, current_stage, region, site_location, est_delivery_date, closed_deal_date, created_at')
          .in('region', regionCodes)
          .is('deleted_at', null)
          .neq('is_archived', true)
          .eq('is_draft', false),
        admin.from('opportunities')
          .select('id, title, stage, region, external_created_at, created_at, external_project_code')
          .in('region', regionCodes)
          .is('deleted_at', null)
          .not('stage', 'in', '(closed_won,closed_lost)'),
      ]);

  type ProjectRow = {
    id: string; code: string; name: string; current_stage: string; region: string | null;
    site_location: string | null; est_delivery_date: string | null; closed_deal_date: string | null;
    created_at: string;
  };
  type OpportunityRow = {
    id: string; title: string; stage: string; region: string | null;
    // external_created_at = the real ClickUp "date created" (when it became an opportunity
    // there — lib/clickup/importOpportunitiesMapping.ts). Set on every imported row, unlike
    // expected_close_date which is often left blank — use it as the card's date, falling back
    // to our own created_at only for opportunities that were never imported from ClickUp.
    external_created_at: string | null; created_at: string;
    external_project_code: string | null;
  };

  const projects = (projectRows ?? []) as ProjectRow[];
  const opportunities = (opportunityRows ?? []) as OpportunityRow[];

  const columns: BoardColumn[] = visibleRegions.map(r => {
    const regionProjects = projects.filter(p => p.region === r.code);
    const regionOpportunities = opportunities.filter(o => o.region === r.code);

    const opportunityItems: BoardCardItem[] = regionOpportunities.map(o => {
      const [top, bottom] = opportunityBadge(o.external_project_code);
      const becameOpportunityDate = (o.external_created_at ?? o.created_at).slice(0, 10);
      return {
        id: o.id, kind: 'opportunity',
        badgeTop: top, badgeBottom: bottom,
        title: o.title,
        subtitle: null,
        dateISO: becameOpportunityDate,
        dateLabel: fmtDate(becameOpportunityDate),
        href: '/marketing/opportunities',
      };
    });

    const toCardItem = (p: ProjectRow): BoardCardItem => {
      const [top, bottom] = projectBadge(p.code);
      const date = p.est_delivery_date ?? p.closed_deal_date;
      return {
        id: p.id, kind: 'project', badgeTop: top, badgeBottom: bottom,
        title: p.name,
        subtitle: p.site_location,
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
      opportunity:   [...opportunityItems].sort(byDate),
      finalization:  [...finalizationItems].sort(byDate),
      technical:     [...technicalItems].sort(byDate),
      to_production: [],
      in_production: [...inProductionItems].sort(byDate),
      shipped:       [],
      ready:         [...readyItems].sort(byDate),
    };

    const sections: BoardSection[] = SECTION_DEFS.map(def => ({
      key: def.key, label: def.label, accent: def.accent, bg: def.bg,
      badgeBg: def.badgeBg, badgeText: def.badgeText,
      items: itemsByKey[def.key],
      emptyLabel: 'No Active Projects',
    }));

    const total = sections.reduce((sum, s) => sum + s.items.length, 0);

    return {
      regionCode: r.code,
      logoSrc: regionLogoByCode(r.dropboxShort),
      logoCode: r.dropboxShort,
      headerColor: HEADER_COLORS[r.code] ?? '#465b6d',
      total,
      sections,
    };
  });

  const { data: marketingAssignees } = await admin.from('profiles')
    .select('id, full_name')
    .in('role', ['marketing_pr', 'marketing_manager', 'sales_rep', 'sales_marketing_manager', 'ops_manager', 'general_manager'])
    .eq('is_active', true).order('full_name', { ascending: true });

  const canEditOpportunities = OPPORTUNITY_EDIT_ROLES.includes(userRole);

  // ── Active Projects / Approvals summary row ──────────────────────────────────────────
  // Reuses the same `projects` this board already fetched (region-scoped) — no second query
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

  return (
    <>
      <TopSummaryRow approvals={approvals} activeCount={activeCount} overdueCount={overdueCount} newThisWeek={newThisWeek} />
      <BranchBoard columns={columns} assignees={marketingAssignees ?? []} canEdit={canEditOpportunities} />
    </>
  );
}
