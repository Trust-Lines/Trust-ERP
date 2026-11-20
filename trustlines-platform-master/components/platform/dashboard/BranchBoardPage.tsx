import type { ReactNode } from 'react';
import { LiveRefresh } from '@/components/platform/shared/LiveRefresh';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect as nextRedirect } from 'next/navigation';
import { REGIONS, SERVICE_LINE_VALUES, serviceLineFromCode, serviceLineFromIndustry } from '@/lib/regions';
import { fetchInChunks } from '@/lib/supabase/chunkedIn';
import { regionLogoByCode } from '@/lib/regionLogo';
import { getAssignedRegions, regionAllows } from '@/lib/access/regionScope';
import { MARKETING_ROLES } from '@/lib/marketing/roles';
import { SALES_HANDOFF_ROLES, SALES_INTAKE_ROLES } from '@/lib/sales/roles';
import { loadClientOpportunities, loadKeyClients, type ClientOpportunityRow } from '@/lib/keyClients/server';
import { buildMatcher, nameTokens, projectNumber } from '@/lib/keyClients/match';
import { quickViewLink } from '@/lib/marketing/quickViewLink';
import { KEY_CLIENT_ADMIN_ROLES } from '@/lib/keyClients/roles';
import { NO_PF_ROLES } from '@/lib/production/access';
import { classifyTrustProject, loadTrustProjects, typeLabel, typeStatuses, type TrustItem, type TrustStage } from '@/lib/trust/board';
import { BranchBoard, type BoardColumn, type BoardSection, type BoardCardItem, type BoardGantt } from '@/components/platform/dashboard/BranchBoard';
import type { DashboardGanttData } from '@/components/platform/dashboard/DashboardGantt';
import { loadGanttStageData } from '@/lib/installations/ganttData';
import { tableMissing } from '@/lib/installations/access';
import type { InstallTeam, Installation } from '@/lib/installations/compute';
import { DailyOverview, TopSummaryRow, type ApprovalSummaryItem, type KpiItem } from '@/components/platform/dashboard/TopSummaryRow';
import { StatTile } from '@/components/platform/dashboard/StatTile';
import { PaymentsTile } from '@/components/platform/dashboard/PaymentsTile';
import { SUPPLIER_READ_ROLES } from '@/lib/suppliers/config';
import { getRolePermissions } from '@/lib/permissions/server';
import { pageAllowed } from '@/lib/permissions/catalog';
import { defaultCompanySideForRole } from '@/lib/profile/metadata';
import { trustDashboard } from '@/lib/dashboard/trustView';
import { buildDealNames, type DealName } from '@/lib/board/cardName';
import {
  BriefcaseBusiness, ClipboardPenLine, DraftingCompass, Factory, Hammer, PackageOpen, Pause, PenLine, Ship,
  type LucideIcon,
} from 'lucide-react';
import { isoDateToUS as fmtDate } from '@/lib/formatters';
import { ownProjectsOnly, seesAllProjects } from '@/lib/permissions/ownProjects';
import { isInstalling as installingOn, loadStageSpells } from '@/lib/board/stageHistory';
import type { StageSpell } from '@/lib/board/stageSpell';

// Shared by /tlines-pm (layout "board", the branch board as it always was) and /dashboard
// (layout "dashboard", Figma TRUST-LINES ERP → "General Manager" node 767:13745): same data,
// same visibility rules and the same board filters — only the page chrome differs.
export type BranchBoardLayout = 'board' | 'dashboard';

// Figma "General Manager" KPI row (818:31798): navy, t4, t4, t9 (Deals Closed), t6 (last tile).
const TILE_TONES = [
  { color: 'var(--ui-btn-solid)', onColor: 'var(--ui-surface-elevated)' },
  { color: 'var(--status-t4-fg)', onColor: 'var(--status-t4-bg)' },
  { color: 'var(--status-t4-fg)', onColor: 'var(--status-t4-bg)' },
  { color: 'var(--status-t9-fg)', onColor: 'var(--status-t9-bg)' },
  { color: 'var(--status-t6-fg)', onColor: 'var(--status-t6-bg)' },
];
const TILE_ICON: Record<KpiItem['key'], LucideIcon> = {
  active: BriefcaseBusiness, design: DraftingCompass, production: Factory, finalizing: Hammer, approvals: ClipboardPenLine,
  to_sign: PenLine, to_order: PackageOpen, on_hold: Pause, shipped: Ship,
};
// Figma 767:14785: five tiles in one row (1560 wide, 16 px gaps).
const TILE_ROW = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5';

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
// Colours: Figma "General Manager" board (node 818:12353) — --board-* tokens in globals.css.
// Installation / Completed (2026-11-16) come from the installation plan (installations table,
// /tlines-pm/installation): In Progress / Delayed / On Hold, or started by date → Installation;
// status Completed → Completed. Only for people who may open the installation plan.
const boardTone = (k: string) => ({ accent: `var(--board-${k}-fg)`, bg: `var(--board-${k}-bg)`, solid: `var(--board-${k}-fg)` });
const SECTION_DEFS = [
  { key: 'opportunity',   label: 'Clients Opportunity',    ...boardTone('opportunity') },
  // Everyone else's open deals (not a key client) — hidden until the board's Leads button.
  { key: 'leads',         label: 'Leads',                  ...boardTone('opportunity') },
  { key: 'finalization',  label: 'Finalization',           ...boardTone('finalization') },
  { key: 'technical',     label: 'Technical / PO + PF',    ...boardTone('technical') },
  { key: 'to_production', label: 'To Production',          ...boardTone('to-production') },
  { key: 'in_production', label: 'Production In Progress', ...boardTone('production') },
  { key: 'shipped',       label: 'Shipped',                ...boardTone('shipped') },
  { key: 'ready',         label: 'Ready For Installation', ...boardTone('ready') },
  { key: 'installation',  label: 'Installation',           ...boardTone('installation') },
  { key: 'completed',     label: 'Completed',              ...boardTone('completed') },
] as const;

// Branch header colours from Figma "General Manager" (818:31888 / 818:32634 / 818:33379 / 818:34126).
const HEADER_COLORS: Record<string, string> = {
  TLINES_NE: '#5E758E',
  TLINES_SE: '#68715B',
  TLINES_NW: 'var(--board-branch-nationwide)',
  CVW:       '#624D46',
};

// Alternating account strips are independent Figma palette values, not calculated shades.
const ACCOUNT_ALT_COLORS: Record<string, string> = {
  TLINES_NE: '#465B6C',
  TLINES_SE: '#3A462B',
  TLINES_NW: '#2D5BA2',
  CVW:       '#79645E',
};

function categoryLabel(values: string[] | null | undefined): string | null {
  return values?.map(v => v.replace(/_/g, ' ')).join(', ') || null;
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

export async function BranchBoardPage({ viewParam, layout, ganttParam = false }: {
  viewParam?: string; layout: BranchBoardLayout;
  /** /dashboard?gantt=1 — show the installation plan's lifecycle Gantt instead of the board. */
  ganttParam?: boolean;
}) {
  const isDashboard = layout === 'dashboard';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) nextRedirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const profile = profileData as { role: string | null; full_name: string | null; company_side?: string | null } | null;
  const userRole = profile?.role ?? 'ops_manager';

  // One page, two dashboards — by the company the person works for (Team → company side):
  // T-Lines (the branch board below) or Trust Lines (lib/dashboard/trustView: the Trust System's
  // production stages). The General Manager sees both and switches between them.
  const side = profile?.company_side ?? defaultCompanySideForRole(userRole);
  const seesBoth = userRole === 'general_manager';
  const view: 'tlines' | 'trust' = seesBoth ? (viewParam === 'trust' ? 'trust' : 'tlines') : side === 'trust_lines' ? 'trust' : 'tlines';

  // Same T-Lines-side boundary as the old dashboard (AGENTS.md §2) — send marketing accounts
  // to their own scoped landing page instead of the branch board.
  if (userRole === 'marketing_pr' || userRole === 'marketing_manager') {
    nextRedirect('/marketing');
  }

  // A Coordinator (profiles.sees_all_projects) sees every region too, not only their assigned ones.
  const assignedRegions = (await seesAllProjects(user.id)) ? [] : await getAssignedRegions(admin, user.id);
  const visibleRegions = REGIONS.filter(r => regionAllows(assignedRegions, r.code));
  const regionCodes = visibleRegions.map(r => r.code);

  // Projects are read through the user's own RLS session — the same visibility as
  // /projects and /projects/[id] — so the board never lists a project the user cannot
  // open. tlines_pm additionally sees only projects they are assigned to.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let projectQuery = (supabase as any).from('projects')
    .select('id, code, name, current_stage, region, site_location, est_delivery_date, closed_deal_date, created_at, categories, tlines_pm_id, service_line')
    .in('region', regionCodes)
    .is('deleted_at', null)
    .neq('is_archived', true)
    .eq('is_draft', false);
  // "Sees every T-Lines project" (profiles.sees_all_projects, 156) lifts the own-only rule.
  const ownOnly = await ownProjectsOnly(userRole, user.id);
  if (ownOnly) projectQuery = projectQuery.eq('tlines_pm_id', user.id);

  // "Clients Opportunity" is not every deal: only the open Opportunities/Potentials of our key
  // clients (key_clients, migration 134 — lib/keyClients/server.ts). Trust follows those before
  // they're signed; everything else waits until it's a project.
  const loadClientOpps = async (): Promise<ClientOpportunityRow[]> => {
    try {
      // Key clients' deals and the leads' (everyone else's, the Leads section).
      const r = await loadClientOpportunities(admin, { includeLeads: true });
      // Clients: only deals with a project number, like the PROJECTS PROGRESS sheet — a numberless
      // Potential is too early. Leads: every open one ("full", behind the Leads button).
      return Object.values(r.regions).flat().filter(o => !!o.region && regionCodes.includes(o.region) && (!!o.projectNo || !o.isClient));
    } catch (e) {
      console.error('[dashboard] client opportunities unavailable (migration 134?):', e instanceof Error ? e.message : e);
      return [];
    }
  };
  // Finalization → Shipped come from the Trust System, by project number (lib/trust/board.ts).
  // The Trust Lines dashboard shows every branch; the T-Lines one only the viewer's regions.
  // The board's "Accounts" view groups every card under its client: a key client when the name
  // matches one (same rule as Clients Opportunity, lib/keyClients/match), else the card's own name.
  // A card's name comes from its Sales deal (lib/board/cardName.ts): the Brand when filled
  // ("VIC" for #1188), else the lead's customer name, else the Trust / project name. The deal is
  // found by project number AND address. Read on every page load, so a Sales edit shows at once.
  const loadDealNames = async (): Promise<DealName[]> => {
    type Row = { id: string; title: string | null; brand: string | null; external_project_code: string | null; project_id?: string | null;
      prospects: { organization_name: string | null; display_name: string | null } | null };
    const toDeal = (kind: DealName['kind']) => (r: Row): DealName => ({
      kind, id: r.id, projectNo: r.external_project_code, projectId: r.project_id ?? null, address: r.title, brand: r.brand,
      customer: r.prospects?.organization_name || r.prospects?.display_name || null,
    });
    try {
      const [o, pt] = await Promise.all([
        admin.from('opportunities').select('id, title, brand, external_project_code, project_id, prospects(organization_name, display_name)')
          .is('deleted_at', null).order('updated_at', { ascending: false }).limit(5000),
        admin.from('prospect_potentials').select('id, title, brand, external_project_code, prospects(organization_name, display_name)')
          .is('deleted_at', null).order('updated_at', { ascending: false }).limit(5000),
      ]) as unknown as [{ data: Row[] | null }, { data: Row[] | null }];
      return [...(o.data ?? []).map(toDeal('opportunity')), ...(pt.data ?? []).map(toDeal('potential'))];
    } catch { return []; }
  };
  const loadAccountMatcher = async () => {
    try { return buildMatcher((await loadKeyClients(admin)).clients); } catch { return buildMatcher([]); }
  };
  const [{ data: projectRows }, opportunities, trust, accountMatcher, dealRows] = regionCodes.length === 0 && view === 'tlines'
    ? [{ data: [] }, [] as ClientOpportunityRow[], { projects: [], error: null }, buildMatcher([]), [] as DealName[]]
    : await Promise.all([projectQuery, loadClientOpps(), loadTrustProjects(), loadAccountMatcher(), loadDealNames()]);
  const dealNames = buildDealNames(dealRows, projectNumber);
  // `alts`: other names of the same job (its Trust System / plan name). A card's Sales brand can be
  // the store's own name ("RICHFILED FOOD MART") while the job belongs to a key client ("HUB"):
  // the account is the first key client any of its names matches.
  const accountOf = (name: string | null | undefined, keyClientId?: string, keyClientName?: string, alts: (string | null | undefined)[] = []) => {
    if (keyClientId && keyClientName) return { key: `kc:${keyClientId}`, name: keyClientName };
    for (const n of [name, ...alts]) {
      const kc = accountMatcher.byName(n);
      if (kc) return { key: `kc:${kc.id}`, name: kc.name };
    }
    // "ALBURAK 1" / "ALBURAK 2" are the same client's sites: drop a trailing site number.
    const base = (name ?? '').trim().replace(/[\s#-]*\d+$/, '').trim() || (name ?? '').trim();
    const tokens = nameTokens(base);
    return { key: tokens.length ? `n:${tokens.join(' ')}` : 'n:', name: base || 'No client' };
  };
  const trustProjects = trust.projects;
  // A project number's Trust System name ("HUB"), for the account of cards named after their brand.
  const trustNameByNo = new Map<string, string>();
  for (const tp of trustProjects) { const n = projectNumber(tp.projectNo); if (n && tp.name && !trustNameByNo.has(n)) trustNameByNo.set(n, tp.name); }
  // "Assign to" on every card, one person per card per stage (board_assignees, migration 137) —
  // empty until it's applied. Keyed "kind:id:stage".
  const boardIds = [...trustProjects.map(p => p.id), ...opportunities.map(o => o.id)];
  const [assignRows, { data: allUsers }] = await Promise.all([
    fetchInChunks(boardIds, chunk => admin.from('board_assignees').select('item_kind, item_id, stage, user_id').in('item_id', chunk))
      .catch(() => []),   // table not there yet (migration 137)
    admin.from('profiles').select('id, full_name, role').eq('is_active', true).not('full_name', 'is', null).order('full_name', { ascending: true }),
  ]) as [{ item_kind: string; item_id: string; stage: string; user_id: string }[], { data: { id: string; full_name: string; role: string | null }[] | null }];
  const assigneeOf = new Map(assignRows.map(a => [`${a.item_kind}:${a.item_id}:${a.stage}`, a.user_id]));
  // The T-Lines PM looks after the card's account, not one stage: when the card has none set for
  // the stage it is in now, the one set in another stage stays, else our project's T-Lines PM
  // (projects.tlines_pm_id) for the same project number.
  const tlinesAnyStage = new Map<string, string>();
  for (const a of assignRows) if (a.stage.endsWith(':tlines_pm')) tlinesAnyStage.set(`${a.item_kind}:${a.item_id}`, a.user_id);
  const tlinesByNo = new Map<string, string>();
  for (const pr of (projectRows ?? []) as { code: string; tlines_pm_id: string | null }[]) {
    const no = projectNumber(pr.code);
    if (no && pr.tlines_pm_id && !tlinesByNo.has(no)) tlinesByNo.set(no, pr.tlines_pm_id);
  }
  // …and the T-Lines PM set on a Trust / deal card with that number, so every card of one project
  // (Trust, deal, installation) shows the same PM.
  for (const p of trustProjects) {
    const no = projectNumber(p.projectNo), pm = tlinesAnyStage.get(`trust:${p.id}`);
    if (no && pm && !tlinesByNo.has(no)) tlinesByNo.set(no, pm);
  }
  for (const o of opportunities) {
    const no = projectNumber(o.projectNo), pm = tlinesAnyStage.get(`${o.kind}:${o.id}`);
    if (no && pm && !tlinesByNo.has(no)) tlinesByNo.set(no, pm);
  }
  // Two people per card per stage: the Trust PM (plain stage) and the T-Lines PM ("<stage>:tlines_pm").
  const assignFor = (kind: string, id: string, stage: string, label: string, projectNo?: string | null) => ({
    kind, stage, label,
    userId: assigneeOf.get(`${kind}:${id}:${stage}`) ?? null,
    tlinesUserId: assigneeOf.get(`${kind}:${id}:${stage}:tlines_pm`) ?? tlinesAnyStage.get(`${kind}:${id}`)
      ?? tlinesByNo.get(projectNumber(projectNo) ?? '') ?? null,
  });
  // The popup's PO + PF / Production / Shipping tabs: the Trust types of the card's project number.
  // tlines_pm never receives PF fields (AGENTS.md §2): the cards' Trust types go out without the
  // PF code / PF sign status. Stages were already worked out from the full data above.
  const noPf = NO_PF_ROLES.has(userRole);
  const cardItems = (items: TrustItem[] | null | undefined): TrustItem[] =>
    (items ?? []).map(i => (noPf ? { ...i, pfCode: null, pfSignStatus: null } : i));
  const trustByNo = new Map(trustProjects.map(p => [p.projectNo, cardItems(p.items)]));
  // A Trust System card only has a number: its company is that of our project / deal with the
  // same number (project: service_line or code prefix; deal: ClickUp Industry or code prefix).
  const companyByNo = new Map<string, string>();
  for (const o of opportunities) {
    const c = serviceLineFromIndustry(o.industry) ?? serviceLineFromCode(o.projectCode);
    if (o.projectNo && c) companyByNo.set(o.projectNo, c);
  }
  for (const p of (projectRows ?? []) as { code: string; service_line: string | null }[]) {
    const no = projectNumber(p.code);
    const c = p.service_line && SERVICE_LINE_VALUES.includes(p.service_line) ? p.service_line : serviceLineFromCode(p.code);
    if (no && c) companyByNo.set(no, c);
  }
  const trustToday = new Date().toISOString().slice(0, 10);
  const allTrustCards = trustProjects.map(p => {
    const e = classifyTrustProject(p, trustToday);
    const brand = dealNames.forCard(p.projectNo, p.address);
    const item: BoardCardItem = {
      id: p.id, kind: 'trust',
      badgeTop: `#${p.projectNo}`, badgeBottom: '',
      title: brand ?? p.name,
      subtitle: p.address,
      account: accountOf(brand ?? p.name, undefined, undefined, [p.name]),
      company: companyByNo.get(p.projectNo) ?? null,
      category: (p.types ?? []).map(typeLabel).filter(Boolean).join(', ') || null,
      pmName: null, pmLabel: '',
      assign: assignFor('trust', p.id, e.stage, `#${p.projectNo}`, p.projectNo),
      onHold: e.onHold,
      dateISO: e.dateISO,
      dateLabel: fmtDate(e.dateISO),
      href: '',
      // The Technical note lists PF codes: never for tlines_pm.
      note: noPf ? null : e.note,
      statuses: typeStatuses(p),
      projectNo: p.projectNo,
      trustItems: cardItems(p.items),
    };
    return { region: p.bucket, stage: e.stage, item, createdAt: p.createdAt };
  });
  const trustCards = allTrustCards.filter(c => regionCodes.includes(c.region));

  // ── Trust Lines dashboard: every branch's Trust System projects by production stage ──────
  if (view === 'trust') {
    const weekAgoIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const t = trustDashboard({ projects: trustProjects, cards: allTrustCards, weekAgo: weekAgoIso });
    return (
      <BranchBoard
        accounts
        heading="Trust Lines Board"
        subheading="Every branch's projects in the Trust System, by production stage."
        columns={t.columns}
        assignees={[]}
        canEdit={false}
        canCreateTask={false}
        trustError={trust.error}
        users={allUsers ?? []}
      meId={user.id}
        canAssign={KEY_CLIENT_ADMIN_ROLES.includes(userRole)}
        layout={layout}
        top={isDashboard
          ? <div key="top-summary"><LiveRefresh name="tlines-pm" tables={['documents', 'document_approvals', 'projects', 'opportunities']} /><DailyOverview fullName={profile?.full_name ?? ''} role={userRole} /></div>
          : <div key="top-summary"><LiveRefresh name="tlines-pm" tables={['documents', 'document_approvals', 'projects', 'opportunities']} /><TopSummaryRow fullName={profile?.full_name ?? ''} role={userRole} kpis={t.kpis} /></div>}
        kpis={isDashboard ? (
          <div key="kpis" className={TILE_ROW}>
            {t.kpis.map((k, i) => {
              const Icon = TILE_ICON[k.key];
              const tone = TILE_TONES[i % TILE_TONES.length];
              return <StatTile key={k.key} label={k.label} value={k.value} icon={<Icon strokeWidth={1.5} />} sub="Trust System, every branch" badge={k.badge} href={k.href} {...tone} />;
            })}
          </div>
        ) : undefined}
      />
    );
  }

  const trustItems = (region: string, stage: TrustStage) =>
    trustCards.filter(c => c.region === region && c.stage === stage).map(c => c.item);

  type ProjectRow = {
    id: string; code: string; name: string; current_stage: string; region: string | null;
    site_location: string | null; est_delivery_date: string | null; closed_deal_date: string | null;
    created_at: string; categories: string[] | null; tlines_pm_id: string | null;
    service_line: string | null;
  };

  const projects = (projectRows ?? []) as ProjectRow[];

  // Installation / Completed rows: the installation plan (installations, migration 142), read only
  // for people allowed to open it (page.installation, same switch as /api/installations). A
  // tlines_pm additionally sees only the installs of their own projects. Missing table → empty.
  type InstallRow = {
    id: string; project_no: string | null; project_name: string | null; branch: string | null; city_state: string | null;
    planned_start: string | null; planned_finish: string | null; team: string | null; scope: string | null;
    pm_name: string | null; status: string | null; blockers: string | null;
  };
  let installRows: InstallRow[] = [];
  const mayOpenInstallations = pageAllowed(userRole, await getRolePermissions(admin, userRole), 'page.installation');
  if (regionCodes.length > 0 && mayOpenInstallations) {
    const { data, error } = await admin.from('installations')
      .select('id, project_no, project_name, branch, city_state, planned_start, planned_finish, team, scope, pm_name, status, blockers')
      .order('sort_order', { ascending: true })
      .limit(2000) as { data: InstallRow[] | null; error: { message: string } | null };
    if (error) console.error('[dashboard] installation plan unavailable (migration 142?):', error.message);
    installRows = data ?? [];
    // Their "Assign to" (Trust PM / T-Lines PM per stage: installation, completed), stored like
    // the Trust cards' under item_kind 'trust' with the installation's id.
    const installAssign = await fetchInChunks(installRows.map(i => i.id), chunk => admin.from('board_assignees')
      .select('item_kind, item_id, stage, user_id').eq('item_kind', 'trust').in('item_id', chunk))
      .catch(() => []) as { item_kind: string; item_id: string; stage: string; user_id: string }[];
    for (const a of installAssign) {
      assigneeOf.set(`${a.item_kind}:${a.item_id}:${a.stage}`, a.user_id);
      if (a.stage.endsWith(':tlines_pm')) tlinesAnyStage.set(`${a.item_kind}:${a.item_id}`, a.user_id);
    }
  }
  // Same rule the daily stage history uses (lib/board/stageHistory).
  const isInstalling = (i: InstallRow) => installingOn(i, trustToday);
  const COMPLETED_PER_COLUMN = 50;

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

  const allColumns: BoardColumn[] = visibleRegions.map(r => {
    const regionProjects = projects.filter(p => p.region === r.code);
    // Like the PROJECTS PROGRESS sheet: grouped by client (A–Z), newest first within a client.
    const regionOpportunities = opportunities.filter(o => o.region === r.code)
      .sort((a, b) => a.client.localeCompare(b.client) || b.createdAt.localeCompare(a.createdAt));

    const toDealCard = (o: ClientOpportunityRow): BoardCardItem => {
      // Badge = the sheet's project number ("#507"); deals without one keep their code / "OP".
      const [top, bottom] = o.projectNo ? [`#${o.projectNo}`, ''] : opportunityBadge(o.projectCode);
      // ClickUp's "date created" when imported (when it became an opportunity there), else ours.
      const becameOpportunityDate = o.createdAt.slice(0, 10);
      return {
        id: o.id, kind: 'opportunity',
        badgeTop: top, badgeBottom: bottom,
        title: dealNames.forDeal(o.kind, o.id) ?? o.client,
        subtitle: o.site || (prospectPlace.get(o.prospectId) ?? null),
        account: accountOf(o.client, o.keyClientId || undefined, o.isClient ? o.client : undefined),
        // Which of our companies: ClickUp's "Industry", else the code prefix ("STSE507").
        company: serviceLineFromIndustry(o.industry) ?? serviceLineFromCode(o.projectCode),
        category: categoryLabel(o.projectTypes.length ? o.projectTypes : o.projectTypeRaw ? [o.projectTypeRaw] : null),
        pmName: o.ownerId ? pmNames.get(o.ownerId) ?? null : null,
        pmLabel: o.ownerIsSales ? 'Sales Owner' : 'Marketing Owner',
        assign: assignFor(o.kind, o.id, 'opportunity', o.projectNo ? `#${o.projectNo}` : o.site, o.projectNo),
        onHold: o.stage === 'on_hold',
        dateISO: becameOpportunityDate,
        dateLabel: fmtDate(becameOpportunityDate),
        href: quickViewLink(o.kind, o.id),
        statuses: o.stageLabel ? [o.stageLabel] : [],
        projectNo: o.projectNo,
        trustItems: o.projectNo ? trustByNo.get(o.projectNo) ?? null : null,
      };
    };
    const opportunityItems = regionOpportunities.filter(o => o.isClient).map(toDealCard);
    const leadItems = regionOpportunities.filter(o => !o.isClient).map(toDealCard);

    const toCardItem = (p: ProjectRow): BoardCardItem => {
      const [top, bottom] = projectBadge(p.code);
      const date = p.est_delivery_date ?? p.closed_deal_date;
      const no = projectNumber(p.code);
      const name = dealNames.forCard(no, p.site_location, p.id) ?? p.name;
      return {
        projectNo: no,
        trustItems: no ? trustByNo.get(no) ?? null : null,
        id: p.id, kind: 'project', badgeTop: top, badgeBottom: bottom,
        title: name,
        subtitle: p.site_location,
        account: accountOf(name, undefined, undefined, [p.name, no ? trustNameByNo.get(no) : null]),
        // Which of our companies (Store Maker / Premium / Design Build): set on the project, else its code.
        company: p.service_line && SERVICE_LINE_VALUES.includes(p.service_line) ? p.service_line : serviceLineFromCode(p.code),
        onHold: heldProjects.has(p.id),
        category: categoryLabel(p.categories),
        pmName: p.tlines_pm_id ? pmNames.get(p.tlines_pm_id) ?? null : null,
        tlinesPmId: p.tlines_pm_id,
        pmLabel: 'T Lines PM',
        dateISO: date,
        dateLabel: fmtDate(date),
        href: `/projects/${p.id}`,
      };
    };

    // Installation plan rows of this branch (installations.branch = NE / SE / NW / CVW).
    const regionInstalls = installRows.filter(i => i.branch === r.dropboxShort && !!i.project_no);
    const installingRows = regionInstalls.filter(isInstalling);
    const completedRows = regionInstalls.filter(i => i.status === 'Completed');
    // The plan writes numbers its own way ("#480 STG 1", "#408M"): match on the digits.
    const installNos = new Set([...installingRows, ...completedRows].map(i => projectNumber(i.project_no)));
    // A card per install, opened like a Trust card (the popup gathers everything by number).
    const toInstallCard = (i: InstallRow): BoardCardItem => {
      // Badge: the plan's number without its own "#" (the badge adds one); lookups: the digits.
      const label = (i.project_no as string).replace(/^#+\s*/, '');
      const no = projectNumber(label) ?? label;
      const name = dealNames.forCard(no, i.city_state) ?? i.project_name ?? `#${no}`;
      const date = i.planned_finish ?? i.planned_start;
      return {
        id: i.id, kind: 'trust',
        badgeTop: `#${label}`, badgeBottom: '',
        title: name,
        subtitle: i.city_state,
        account: accountOf(name, undefined, undefined, [i.project_name, trustNameByNo.get(no)]),
        company: companyByNo.get(no) ?? null,
        category: i.scope,
        pmName: i.pm_name, pmLabel: 'PM',
        // Trust PM / T-Lines PM like every other card; the T-Lines PM falls back to the one set
        // in the other stage, else the project number's.
        assign: assignFor('trust', i.id, i.status === 'Completed' ? 'completed' : 'installation', `#${label}`, no),
        onHold: i.status === 'On Hold',
        dateISO: date,
        dateLabel: fmtDate(date),
        href: '',
        note: i.blockers,
        statuses: i.status ? [i.status] : [],
        projectNo: no,
        trustItems: trustByNo.get(no) ?? null,
      };
    };

    // A delivered project whose install has started / finished sits in Installation / Completed.
    const readyItems        = regionProjects
      .filter(p => p.current_stage === 'delivered' && !installNos.has(projectNumber(p.code)))
      .map(toCardItem);

    // Newest date first within each section, undated cards pushed to the end (never dropped).
    const byDate = (a: BoardCardItem, b: BoardCardItem) =>
      a.dateISO && b.dateISO ? b.dateISO.localeCompare(a.dateISO) : a.dateISO ? -1 : b.dateISO ? 1 : 0;

    const itemsByKey: Record<string, BoardCardItem[]> = {
      opportunity:   opportunityItems,                     // already in client order
      leads:         leadItems,
      finalization:  trustItems(r.code, 'finalization').sort(byDate),
      technical:     trustItems(r.code, 'technical').sort(byDate),
      to_production: trustItems(r.code, 'to_production').sort(byDate),
      in_production: trustItems(r.code, 'in_production').sort(byDate),
      shipped:       trustItems(r.code, 'shipped').sort(byDate),
      ready:         [...readyItems].sort(byDate),
      installation:  installingRows.map(toInstallCard).sort(byDate),
      // Newest finished first, capped so the column stays bounded as the plan grows.
      completed:     completedRows.map(toInstallCard).sort(byDate).slice(0, COMPLETED_PER_COLUMN),
    };

    const sections: BoardSection[] = SECTION_DEFS.map(def => ({
      key: def.key, label: def.label, accent: def.accent, bg: def.bg, solid: def.solid,
      items: itemsByKey[def.key],
      emptyLabel: 'No Active Projects',
    }));

    return {
      regionCode: r.code, name: r.label,
      logoSrc: regionLogoByCode(r.dropboxShort),
      logoCode: r.dropboxShort,
      headerColor: HEADER_COLORS[r.code] ?? HEADER_COLORS.TLINES_NE,
      accountAltColor: ACCOUNT_ALT_COLORS[r.code] ?? ACCOUNT_ALT_COLORS.TLINES_NE,
      sections,
    };
  });

  // A T-Lines PM sees only the cards they are the T-Lines PM of — every stage, installation and
  // completed included (they own the job end to end). Done here, on the server, not in the browser.
  const columns = !ownOnly ? allColumns : allColumns.map(c => ({
    ...c,
    sections: c.sections.map(s => ({ ...s, items: s.items.filter(i => (i.assign?.tlinesUserId ?? i.tlinesPmId ?? null) === user.id) })),
  }));

  // Which step each card was in on past days (board_stage_spells, 157) — for the step + From / To
  // filter. Only the cards on this viewer's board go to the browser.
  const allSpells = await loadStageSpells(admin);
  const stageSpells: Record<string, StageSpell[]> = {};
  for (const c of columns) for (const sec of c.sections) for (const i of sec.items) {
    const k = `${i.kind}:${i.id}`;
    if (allSpells[k]) stageSpells[k] = allSpells[k];
  }

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
  // The board's project rows come from the Trust System, so the counts do too (same visible
  // regions): Finalizing = Finalization, In Design = Technical / PO + PF, In Production = To
  // Production + Production In Progress + Shipped. Falls back to our own projects without Trust.
  const trustKpi = (key: KpiItem['key'], label: string, stages: TrustStage[]): KpiItem => {
    const rows = trustCards.filter(c => stages.includes(c.stage));
    const fresh = rows.filter(c => c.createdAt >= weekAgo).length;
    return { key, label, value: rows.length, href: '/tlines-pm', badge: fresh > 0 ? `+${fresh} New` : undefined };
  };
  const useTrust = trustCards.length > 0;
  const trustNew = trustCards.filter(c => c.createdAt >= weekAgo).length;
  const kpis: KpiItem[] = [
    useTrust
      ? { key: 'active', label: 'Active Projects', value: trustCards.length, href: '/tlines-pm', badge: trustNew > 0 ? `+${trustNew} New` : undefined }
      : {
          key: 'active', label: 'Active Projects', value: activeCount, href: '/projects',
          // Overdue is the more urgent signal; fall back to "new this week" when nothing is late.
          badge: overdueCount > 0 ? `${overdueCount} overdue` : newThisWeek > 0 ? `+${newThisWeek} New` : undefined,
        },
    useTrust ? trustKpi('design', 'In Design', ['technical']) : stageKpi('design', 'In Design', ['client_approval']),
    useTrust ? trustKpi('production', 'In Production', ['to_production', 'in_production', 'shipped']) : stageKpi('production', 'In Production', ['production']),
    useTrust ? trustKpi('finalizing', 'Finalizing', ['finalization']) : stageKpi('finalizing', 'Finalizing', ['closed_deal', 'finalization']),
    { key: 'approvals', label: 'Approvals', value: approvals.length, href: '/approvals', badge: approvals.length > 0 ? 'Pending' : undefined },
  ];

  // ── Dashboard layout: the project counts are counted in the board from the cards its filters
  // leave (BranchBoard COUNT_TILES). Only the one tile that isn't a card count comes from here:
  // supplier payments for roles that may read vendor cost (SUPPLIER_READ_ROLES, as /api/suppliers),
  // Pending Approvals for everyone else.
  let dashboardKpis: ReactNode;
  if (isDashboard) {
    dashboardKpis = (SUPPLIER_READ_ROLES as readonly string[]).includes(userRole)
      ? <PaymentsTile key="payments" compact {...TILE_TONES[4]} />
      : <StatTile key="approvals" compact label="Pending Approvals" value={approvals.length} icon={<ClipboardPenLine strokeWidth={1.5} />} href="/approvals"
          sub={isApprovalsAdmin ? 'Waiting for a decision' : 'Waiting for you'} {...TILE_TONES[4]} />;
  }

  // ── Dashboard Gantt view ("View as Gantt chart", ?gantt=1) ──────────────────────────────────
  // Offered to the same people as the installation plan (page.installation — same switch as
  // /tlines-pm/installation and /api/installations). Its data is read only while it shows, so the
  // board's own render pays nothing. Rows: the plan's projects in the viewer's branches (a plan
  // row without a branch only when every branch is visible); dates only — no PF, vendor or money.
  let gantt: BoardGantt | undefined;
  if (isDashboard && mayOpenInstallations && regionCodes.length > 0) {
    const active = ganttParam;
    let data: DashboardGanttData | null = null;
    if (active) {
      const [{ data: planRows, error: planError }, { data: teamRows }, { data: projectRefs }] = await Promise.all([
        admin.from('installations').select('*').order('sort_order', { ascending: true }).limit(2000),
        admin.from('install_teams').select('*').order('sort_order', { ascending: true }).order('name'),
        admin.from('projects').select('id, code, closed_deal_date').is('deleted_at', null).limit(5000),
      ]) as [{ data: Installation[] | null; error: { code?: string; message: string } | null }, { data: InstallTeam[] | null }, { data: { id: string; code: string | null; closed_deal_date: string | null }[] | null }];
      if (planError) console.error('[dashboard] gantt: installation plan unavailable:', planError.message);
      const branches = new Set(visibleRegions.map(r => r.dropboxShort));
      const everyBranch = visibleRegions.length === REGIONS.length;
      const rows = (planRows ?? []).filter(r => (r.branch ? branches.has(r.branch) : everyBranch));
      const stages = await loadGanttStageData(admin, rows, projectRefs ?? [], trustToday, trustProjects);
      data = {
        ...stages, rows, teams: teamRows ?? [], today: trustToday,
        error: planError ? (tableMissing(planError) ? 'The installation plan isn’t set up in the database yet (migration 142).' : 'The installation plan could not be loaded.') : null,
      };
    }
    gantt = { active, href: active ? '/dashboard' : '/dashboard?gantt=1', data };
  }

  return (
    <BranchBoard
      accounts
      byPm
      gantt={gantt}
      layout={layout}
      kpis={dashboardKpis}
      columns={columns}
      stageSpells={stageSpells}
      assignees={marketingAssignees ?? []}
      canEdit={canEditOpportunities}
      // A card's company: managers can always set it; a T-Lines PM only when it has none.
      companyEdit={['general_manager', 'ops_manager'].includes(userRole) ? 'any' : userRole === 'tlines_pm' ? 'empty' : 'none'}
      canCreateTask={SALES_INTAKE_ROLES.includes(userRole)}
      trustError={trust.error}
      users={allUsers ?? []}
      meId={user.id}
      canAssign={KEY_CLIENT_ADMIN_ROLES.includes(userRole)}
      // A server element passed as a prop into a client component is checked like a list child in
      // dev (React 19 / Next 16) — the key only silences that false "unique key" warning.
      top={isDashboard
        ? <div key="top-summary"><LiveRefresh name="tlines-pm" tables={['documents', 'document_approvals', 'projects', 'opportunities']} /><DailyOverview fullName={profile?.full_name ?? ''} role={userRole} /></div>
        : <div key="top-summary"><LiveRefresh name="tlines-pm" tables={['documents', 'document_approvals', 'projects', 'opportunities']} /><TopSummaryRow fullName={profile?.full_name ?? ''} role={userRole} kpis={kpis} /></div>}
    />
  );
}
