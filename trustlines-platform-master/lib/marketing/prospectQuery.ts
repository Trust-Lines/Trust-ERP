import { NextResponse } from 'next/server';
import { MARKETING_SEE_ALL_ROLES } from '@/lib/marketing/roles';
import { getAssignedRegions } from '@/lib/access/regionScope';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Shared between app/api/marketing/prospects/route.ts (list + CSV export) and
// app/api/marketing/prospects/bulk-send/route.ts (the "send with a template" action) — both
// need to resolve the SAME query-builder criteria (2026-09-23/24: Contacts is query-first, no
// browsing) to the same set of matching prospects. Keeping this in one place means the two
// routes can never quietly disagree about who "the current query" actually includes.

export interface ProspectQueryParams {
  q: string;
  status: string;
  region: string;
  source: string;
  completeness: string;
  includeArchived: boolean;
  campaignId: string;
  surveyOnly: boolean;
  projectStatus: string; // '' | 'active' | 'finished' | 'none'
}

export function parseProspectQueryParams(url: URL): ProspectQueryParams {
  return {
    q: (url.searchParams.get('q') ?? '').trim(),
    status: (url.searchParams.get('status') ?? '').trim(),
    region: (url.searchParams.get('region') ?? '').trim(),
    source: (url.searchParams.get('source') ?? '').trim(),
    completeness: (url.searchParams.get('completeness') ?? '').trim(),
    includeArchived: url.searchParams.get('includeArchived') === '1',
    campaignId: (url.searchParams.get('campaignId') ?? '').trim(),
    surveyOnly: url.searchParams.get('surveyOnly') === '1',
    projectStatus: (url.searchParams.get('projectStatus') ?? '').trim(),
  };
}

export function hasAnyCriterion(p: ProspectQueryParams): boolean {
  return !!(p.q || p.status || p.region || p.source || p.completeness || p.campaignId || p.surveyOnly || p.projectStatus);
}

const intersect = (a: string[] | null, b: string[]) => (a === null ? b : a.filter(x => new Set(b).has(x)));
const prospectIdColumn = (rows: unknown[] | null): string[] =>
  ((rows ?? []) as { prospect_id: string }[]).map(r => r.prospect_id);

// Project status: don't rely on our own `projects` table alone — most historical deals were
// opened AND closed entirely in ClickUp, long before this system's internal project pipeline
// existed, and never got a `projects` row / `opportunities.project_id` at all. ClickUp's own
// "Status OP" already recorded the real outcome, imported as opportunities.stage (see
// lib/clickup/importOpportunitiesMapping.ts's STATUS_OP_MAP — 'DEAL CLOSED' → 'closed_won').
// So "finished"/"active" reads BOTH signals: our own projects.current_stage where a project
// row exists, OR the imported opportunity stage where it doesn't.
const ACTIVE_OPP_STAGES = ['sales_handoff', 'sales_accepted', 'discovery', 'sales_design', 'proposal', 'negotiation', 'working_on_it_trust', 'on_hold'];

export async function computeProspectWhitelist(admin: any, p: ProspectQueryParams):
  Promise<{ includeIds: string[] | null; excludeIds: string[] } | { error: string }> {
  let includeIds: string[] | null = null;
  const excludeIds: string[] = [];

  if (p.campaignId || p.surveyOnly) {
    let ciQuery = admin.from('campaign_interactions').select('prospect_id');
    if (p.campaignId) ciQuery = ciQuery.eq('campaign_id', p.campaignId);
    if (p.surveyOnly) ciQuery = ciQuery.not('survey_submission_id', 'is', null);
    const { data: ciRows, error: ciError } = await ciQuery;
    if (ciError) return { error: ciError.message };
    includeIds = intersect(includeIds, [...new Set(prospectIdColumn(ciRows))]);
  }

  if (p.projectStatus === 'none') {
    const { data: oppRows, error: oppError } = await admin.from('opportunities').select('prospect_id')
      .or('project_id.not.is.null,stage.eq.closed_won');
    if (oppError) return { error: oppError.message };
    excludeIds.push(...new Set(prospectIdColumn(oppRows)));
  } else if (p.projectStatus === 'active' || p.projectStatus === 'finished') {
    const { data: stageOppRows, error: stageOppError } = p.projectStatus === 'finished'
      ? await admin.from('opportunities').select('prospect_id').eq('stage', 'closed_won')
      : await admin.from('opportunities').select('prospect_id').in('stage', ACTIVE_OPP_STAGES);
    if (stageOppError) return { error: stageOppError.message };
    const fromStage = prospectIdColumn(stageOppRows);

    let projQuery = admin.from('projects').select('id');
    projQuery = p.projectStatus === 'finished' ? projQuery.eq('current_stage', 'delivered') : projQuery.neq('current_stage', 'delivered');
    const { data: projRows, error: projError } = await projQuery;
    if (projError) return { error: projError.message };
    const projectIds = ((projRows ?? []) as { id: string }[]).map(row => row.id);
    let fromProject: string[] = [];
    if (projectIds.length > 0) {
      const { data: oppRows, error: oppError } = await admin.from('opportunities').select('prospect_id').in('project_id', projectIds);
      if (oppError) return { error: oppError.message };
      fromProject = prospectIdColumn(oppRows);
    }

    includeIds = intersect(includeIds, [...new Set([...fromStage, ...fromProject])]);
  }

  return { includeIds, excludeIds };
}

export interface ProspectFilterContext {
  userRole: string;
  assignedRegions: string[];
  p: ProspectQueryParams;
  includeIds: string[] | null;
  excludeIds: string[];
}

export async function buildFilterContext(admin: any, userId: string, userRole: string, p: ProspectQueryParams):
  Promise<ProspectFilterContext | { error: string }> {
  const whitelist = await computeProspectWhitelist(admin, p);
  if ('error' in whitelist) return whitelist;
  const assignedRegions = userRole === 'marketing_pr' ? await getAssignedRegions(admin, userId) : [];
  return { userRole, assignedRegions, p, includeIds: whitelist.includeIds, excludeIds: whitelist.excludeIds };
}

export function applyProspectFilters(query: any, ctx: ProspectFilterContext): any {
  const { userRole, assignedRegions, p, includeIds, excludeIds } = ctx;
  if (!MARKETING_SEE_ALL_ROLES.includes(userRole) && assignedRegions.length > 0) {
    // A Contact cross-listed in two ClickUp regions stays visible to whichever region's
    // marketing_pr is assigned; one with NO region yet stays visible to everyone (108/109/111/112).
    query = query.or(`regions.ov.{${assignedRegions.join(',')}},regions.eq.{}`);
  }
  // clickup-import-potentials-only.mts's --allow-fallback placeholder rows (an address as the
  // "name") never belong here — see app/api/marketing/prospects/route.ts's longer comment on
  // why this needs an explicit is.null branch, not a bare .not('external_ref','like',…).
  query = query.or('external_ref.is.null,external_ref.not.like.opportunity-fallback:%');
  if (!p.includeArchived) query = query.eq('is_archived', false);
  if (p.status) query = query.eq('status', p.status);
  if (p.region) query = query.contains('regions', [p.region]);
  if (p.source) query = query.eq('source_label', p.source);
  if (includeIds !== null) query = query.in('id', includeIds);
  if (excludeIds.length > 0) query = query.not('id', 'in', `(${excludeIds.join(',')})`);
  if (p.q) {
    const safe = p.q.replace(/[%,()\\]/g, '\\$&');
    query = query.or(`display_name.ilike.%${safe}%,brand_name.ilike.%${safe}%,industry.ilike.%${safe}%`);
  }
  return query;
}

// Paginated fetch past PostgREST's ~1000-row-per-request cap (see route.ts's long-standing
// comment on this — verified live, a bare .limit(5000) still came back capped at 1000).
export async function fetchAllMatching<T>(
  admin: any, table: string, cols: string, ctx: ProspectFilterContext, cap = 5000,
): Promise<{ rows: T[] } | { error: string }> {
  const FETCH_PAGE = 1000;
  const rows: T[] = [];
  for (let offset = 0; offset < cap; offset += FETCH_PAGE) {
    const query = applyProspectFilters(admin.from(table).select(cols).is('deleted_at', null), ctx)
      .range(offset, offset + FETCH_PAGE - 1);
    const { data, error } = await query;
    if (error) return { error: error.message };
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < FETCH_PAGE) break;
  }
  return { rows };
}

export function whitelistErrorResponse(e: { error: string }) {
  return NextResponse.json({ error: e.error }, { status: 500 });
}
