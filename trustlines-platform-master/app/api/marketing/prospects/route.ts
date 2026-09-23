import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_READ_ROLES, MARKETING_WRITE_ROLES, MARKETING_SEE_ALL_ROLES } from '@/lib/marketing/roles';
import { findProspectDuplicates } from '@/lib/marketing/duplicates';
import { PROJECT_TYPES, SCOPE_TYPES, TIMINGS, ENTITY_TYPES } from '@/lib/marketing/classification';
import { runClassificationForNeed } from '@/lib/marketing/opportunityEngine';
import { REGION_CODES, SERVICE_LINE_VALUES } from '@/lib/regions';
import { enrichProspectRows, type ProspectListBase } from '@/lib/marketing/prospectRows';
import { getAssignedRegions } from '@/lib/access/regionScope';
import type { LeadEntityType } from '@/types/database';

const LIST_COLS = 'id, entity_type, display_name, organization_name, person_name, brand_name, industry, status, location_count, '
  + 'source_label, source_raw_label, source_detail, business_types, tags, main_email, main_phone, website, x_note, '
  + 'region, project_types, scope_types, timing, target_contact_date, next_action, next_action_date, '
  + 'owner_id, assigned_marketing_user_id, is_archived, created_at, updated_at, external_created_at, effective_created_at';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function GET(req: NextRequest) {
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  const userId = user.id;
  const userRole = role;

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const status = (url.searchParams.get('status') ?? '').trim();
  const region = (url.searchParams.get('region') ?? '').trim();
  const source = (url.searchParams.get('source') ?? '').trim();
  // 'missing' = completeness_percent < 100. Not a real DB column (enrichProspectRows
  // computes it per-row, after the usual DB-level pagination) — see the branch below.
  const completeness = (url.searchParams.get('completeness') ?? '').trim();
  const includeArchived = url.searchParams.get('includeArchived') === '1';
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));

  // Query-builder criteria (2026-09-23 decision: Marketing no longer gets to browse every
  // Contact — see the "no criterion at all" guard below). campaignId/surveyOnly answer "who
  // interacted with campaign X / came in through a survey" via campaign_interactions;
  // projectStatus answers "who currently has / had / never had a project" via
  // opportunities.project_id → projects.current_stage.
  const campaignId = (url.searchParams.get('campaignId') ?? '').trim();
  const surveyOnly = url.searchParams.get('surveyOnly') === '1';
  const projectStatus = (url.searchParams.get('projectStatus') ?? '').trim(); // '' | 'active' | 'finished' | 'none'
  const exportMode = url.searchParams.get('export') === '1';

  const hasAnyCriterion = !!(q || status || region || source || completeness || campaignId || surveyOnly || projectStatus);
  // No role exception — every MARKETING_READ_ROLES account (marketing_pr, marketing_manager,
  // general_manager, ops_manager) must build a query before any row comes back. "kimse
  // görmeyecek" (2026-09-23): a full-authority role browsing the whole Contacts table wasn't
  // the intent, only the query-driven mailing-list workflow is.
  if (!hasAnyCriterion) {
    return NextResponse.json({ prospects: [], contacts: [], total: 0, page, pageSize, queryRequired: true });
  }

  let includeIds: string[] | null = null; // intersected across every "who matches" criterion below
  const excludeIds: string[] = [];
  const intersect = (a: string[] | null, b: string[]) => (a === null ? b : a.filter(x => new Set(b).has(x)));
  const prospectIdColumn = (rows: unknown[] | null): string[] =>
    ((rows ?? []) as { prospect_id: string }[]).map(r => r.prospect_id);

  if (campaignId || surveyOnly) {
    let ciQuery = admin.from('campaign_interactions').select('prospect_id');
    if (campaignId) ciQuery = ciQuery.eq('campaign_id', campaignId);
    if (surveyOnly) ciQuery = ciQuery.not('survey_submission_id', 'is', null);
    const { data: ciRows, error: ciError } = await ciQuery;
    if (ciError) return NextResponse.json({ error: ciError.message }, { status: 500 });
    includeIds = intersect(includeIds, [...new Set(prospectIdColumn(ciRows))]);
  }

  // Project status: don't rely on our own `projects` table alone — most historical deals were
  // opened AND closed entirely in ClickUp, long before this system's internal project pipeline
  // existed, and never got a `projects` row / `opportunities.project_id` at all. ClickUp's own
  // "Status OP" already recorded the real outcome, imported as opportunities.stage (see
  // lib/clickup/importOpportunitiesMapping.ts's STATUS_OP_MAP — 'DEAL CLOSED' → 'closed_won').
  // So "finished"/"active" here reads BOTH signals: our own projects.current_stage where a
  // project row exists, OR the imported opportunity stage where it doesn't.
  const ACTIVE_OPP_STAGES = ['sales_handoff', 'sales_accepted', 'discovery', 'sales_design', 'proposal', 'negotiation', 'working_on_it_trust', 'on_hold'];

  if (projectStatus === 'none') {
    const { data: oppRows, error: oppError } = await admin.from('opportunities').select('prospect_id')
      .or('project_id.not.is.null,stage.eq.closed_won');
    if (oppError) return NextResponse.json({ error: oppError.message }, { status: 500 });
    excludeIds.push(...new Set(prospectIdColumn(oppRows)));
  } else if (projectStatus === 'active' || projectStatus === 'finished') {
    // Signal 1: an opportunity whose own ClickUp-sourced stage already says so.
    const { data: stageOppRows, error: stageOppError } = projectStatus === 'finished'
      ? await admin.from('opportunities').select('prospect_id').eq('stage', 'closed_won')
      : await admin.from('opportunities').select('prospect_id').in('stage', ACTIVE_OPP_STAGES);
    if (stageOppError) return NextResponse.json({ error: stageOppError.message }, { status: 500 });
    const fromStage = prospectIdColumn(stageOppRows);

    // Signal 2: a linked internal project at the matching lifecycle stage.
    let projQuery = admin.from('projects').select('id');
    projQuery = projectStatus === 'finished' ? projQuery.eq('current_stage', 'delivered') : projQuery.neq('current_stage', 'delivered');
    const { data: projRows, error: projError } = await projQuery;
    if (projError) return NextResponse.json({ error: projError.message }, { status: 500 });
    const projectIds = ((projRows ?? []) as { id: string }[]).map(p => p.id);
    let fromProject: string[] = [];
    if (projectIds.length > 0) {
      const { data: oppRows, error: oppError } = await admin.from('opportunities').select('prospect_id').in('project_id', projectIds);
      if (oppError) return NextResponse.json({ error: oppError.message }, { status: 500 });
      fromProject = prospectIdColumn(oppRows);
    }

    includeIds = intersect(includeIds, [...new Set([...fromStage, ...fromProject])]);
  }

  // 🔴 2026-09-17: 'created_at' needs to show/sort by the real ClickUp date when a Contact
  // has one (external_created_at) and fall back to our own created_at otherwise — losing the
  // real ClickUp dates isn't acceptable, but sorting by external_created_at alone buried
  // every ClickUp-less Contact ("Cco, llc"/"Town mart") at the very bottom regardless of how
  // recently it was actually added. Plain .order() can't express that COALESCE, so
  // migration 114 added prospects.effective_created_at as a real generated column
  // (COALESCE(external_created_at, created_at)) — sort AND display both use it now, so they
  // always agree.
  const SORT_COLUMNS: Record<string, string> = { created_at: 'effective_created_at', source: 'source_raw_label' };
  const sortKey = url.searchParams.get('sort') ?? '';
  const sortDir = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
  const sortColumn = SORT_COLUMNS[sortKey] ?? null;

  // 🔴 2026-09-16: this route's own filter was a hardcoded ownership-only `.or()` for any
  // role outside MARKETING_SEE_ALL_ROLES (i.e. marketing_pr, the only other role
  // MARKETING_READ_ROLES allows here) — never updated when migrations 108/109 made
  // marketing_pr's visibility region-aware (region match if assigned, otherwise
  // everything). Since this route uses the admin/service-role client, RLS never applied
  // here either, so the initial server-rendered list (RLS-scoped, correct) and this
  // client-side refetch (this route, still ownership-only) disagreed — reported as "the
  // whole list disappears after closing a Prospect's detail view, a refresh fixes it":
  // closing the detail view calls load(page), which hits this route and got 0 rows back
  // for a marketing_pr who owns nothing but (per 109) should see everything.
  const assignedRegions = userRole === 'marketing_pr' ? await getAssignedRegions(admin, userId) : [];

  function applyFilters<T>(q0: T): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = q0 as any;
    if (!MARKETING_SEE_ALL_ROLES.includes(userRole)) {
      if (assignedRegions.length > 0) {
        // regions is the array of every region a Contact genuinely belongs to (111) — a
        // Contact cross-listed in two ClickUp regions must stay visible to whichever
        // region's marketing_pr is assigned, matching prospects_read_own's `&&` overlap.
        // A Contact with NO region yet (public survey submissions can't collect one) stays
        // visible to everyone too (112) — otherwise it's invisible to every region-scoped
        // marketing_pr and only a no-region one could ever triage it into a region.
        query = query.or(`regions.ov.{${assignedRegions.join(',')}},regions.eq.{}`);
      }
      // else: no assigned region → unrestricted, matching prospects_read_own (108/109).
    }
    // 🔴 2026-09-17: clickup-import-potentials-only.mts's --allow-fallback creates a
    // placeholder Contact (address as its name — "opportunity-fallback:<taskId>" as
    // external_ref) purely to satisfy prospect_potentials.prospect_id's NOT NULL FK when a
    // Potential-stage ClickUp task has no real linked Contact at all. It was never meant to
    // be a real Contact — Contacts is company/person names only, an address belongs on the
    // Potential/Opportunity itself. Excluded here; the Potential still shows normally on
    // the Opportunities board (which reads its own `title`, not this hidden row's name).
    // 🔴 2026-09-17: `.not('external_ref', 'like', ...)` alone silently dropped EVERY
    // Contact with a NULL external_ref too — SQL's `NOT (NULL LIKE 'x%')` evaluates to NULL,
    // not TRUE, so WHERE excludes it. That's most survey-native/manually-created Contacts —
    // caught live when two records deliberately preserved through the ClickUp re-import
    // ("Cco, llc", "Town mart") had vanished from the list entirely. `.or()` with an
    // explicit `is.null` branch lets NULL rows through as intended.
    query = query.or('external_ref.is.null,external_ref.not.like.opportunity-fallback:%');
    if (!includeArchived) query = query.eq('is_archived', false);
    if (status) query = query.eq('status', status);
    if (region) query = query.contains('regions', [region]);
    if (source) query = query.eq('source_label', source);
    if (includeIds !== null) query = query.in('id', includeIds);
    if (excludeIds.length > 0) query = query.not('id', 'in', `(${excludeIds.join(',')})`);
    if (q) {
      const safe = q.replace(/[%,()\\]/g, '\\$&');
      query = query.or(`display_name.ilike.%${safe}%,brand_name.ilike.%${safe}%,industry.ilike.%${safe}%`);
    }
    return query;
  }

  if (exportMode) {
    // Bulk-mail export: every matching row's name+email, ignoring pagination (capped, same
    // 1000-row-per-request PostgREST ceiling worked around as the completeness branch below).
    // completeness='missing' isn't supported in combination with export — it's a per-row
    // computed field, not something worth the extra enrichment pass for a mailing-list export.
    const EXPORT_CAP = 5000;
    const FETCH_PAGE = 1000;
    const rows: { display_name: string; main_email: string | null }[] = [];
    for (let offset = 0; offset < EXPORT_CAP; offset += FETCH_PAGE) {
      const pageQuery = applyFilters(admin.from('prospects').select('display_name, main_email').is('deleted_at', null))
        .range(offset, offset + FETCH_PAGE - 1);
      const { data, error } = await pageQuery;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      rows.push(...((data ?? []) as { display_name: string; main_email: string | null }[]));
      if (!data || data.length < FETCH_PAGE) break;
    }
    const withEmail = rows.filter(r => r.main_email);
    return NextResponse.json({
      contacts: withEmail.map(r => ({ name: r.display_name, email: r.main_email as string })),
      total: rows.length,
    });
  }

  if (completeness === 'missing') {
    // completeness_percent isn't a DB column (enrichProspectRows computes it per-row from
    // contacts/location/source data), so DB-level range() pagination can't filter on it —
    // fetch every row matching the OTHER filters (capped well above current real volume),
    // enrich all of them, filter, then paginate in memory.
    //
    // 🔴 2026-09-16: PostgREST silently caps any single request at 1000 rows regardless of
    // .limit() (verified live — a plain .limit(5000) query still came back with exactly
    // 1000 rows against a table with 2220), so a single query here would have quietly
    // dropped 1000+ real prospects from consideration. Page through in chunks of 1000 with
    // .range() until either the cap or a short page (end of table) is hit.
    const MISSING_INFO_CAP = 5000;
    const FETCH_PAGE = 1000;
    const allData: unknown[] = [];
    for (let offset = 0; offset < MISSING_INFO_CAP; offset += FETCH_PAGE) {
      let pageQuery = applyFilters(admin.from('prospects').select(LIST_COLS).is('deleted_at', null));
      pageQuery = sortColumn
        ? pageQuery.order(sortColumn, { ascending: sortDir === 'asc', nullsFirst: false }).order('effective_created_at', { ascending: false })
        : pageQuery.order('effective_created_at', { ascending: false });
      pageQuery = pageQuery.range(offset, offset + FETCH_PAGE - 1);
      const { data: pageData, error: pageError } = await pageQuery;
      if (pageError) return NextResponse.json({ error: pageError.message }, { status: 500 });
      allData.push(...(pageData ?? []));
      if (!pageData || pageData.length < FETCH_PAGE) break;
    }

    const allEnriched = await enrichProspectRows(admin, allData as unknown as ProspectListBase[]);
    const missing = allEnriched.filter(p => p.completeness_percent < 100);
    const from = (page - 1) * pageSize;
    return NextResponse.json({ prospects: missing.slice(from, from + pageSize), total: missing.length, page, pageSize });
  }

  const countQuery = applyFilters(admin.from('prospects').select('id', { count: 'exact', head: true }).is('deleted_at', null));
  const { count, error: countError } = await countQuery;
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let dataQuery = applyFilters(admin.from('prospects').select(LIST_COLS).is('deleted_at', null));
  dataQuery = sortColumn
    ? dataQuery.order(sortColumn, { ascending: sortDir === 'asc', nullsFirst: false }).order('effective_created_at', { ascending: false })
    : dataQuery.order('effective_created_at', { ascending: false });
  dataQuery = dataQuery.range(from, to);
  const { data, error } = await dataQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = await enrichProspectRows(admin, (data ?? []) as unknown as ProspectListBase[]);
  return NextResponse.json({ prospects: enriched, total: count ?? 0, page, pageSize });
}

export async function POST(req: NextRequest) {
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as {
    entity_type?: string; organization_name?: string; person_name?: string;
    brand_name?: string; industry?: string; website?: string;
    main_email?: string; main_phone?: string; company_size?: string; location_count?: number;
    owner_id?: string; assigned_marketing_user_id?: string;
    source_label?: string; source_raw_label?: string; tags?: { name: string; color: string }[];
    contact?: { name?: string; title?: string; email?: string; phone?: string; is_decision_maker?: boolean; preferred_contact_method?: string };
    additionalContact?: { name?: string; title?: string; email?: string; phone?: string; is_decision_maker?: boolean; preferred_contact_method?: string };
    location?: { city?: string; state?: string; country?: string; is_active?: boolean };
    need?: {
      title?: string; description?: string;
      project_types?: string[]; scope_types?: string[];
      has_active_project?: boolean; deadline?: string; expected_start_date?: string;
      layout_available?: boolean; site_ready?: boolean;
      timing?: string; target_contact_date?: string;
      region?: string; service_line?: string; state?: string;
    };
  } | null;

  const entityType: LeadEntityType = body?.entity_type && (ENTITY_TYPES as string[]).includes(body.entity_type)
    ? body.entity_type as LeadEntityType : 'organization';

  const organizationName = body?.organization_name?.trim() || null;
  const personName = body?.person_name?.trim() || null;
  if (entityType === 'organization' && !organizationName) {
    return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
  }
  if (entityType === 'person' && !personName) {
    return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
  }
  // 🔴 2026-09-17: manual capture never actually wrote region/regions onto the prospects
  // row at all (only onto its Need, a separate table) — a Contact created this way was
  // invisible to any marketing_pr scoped to a region, and never showed up filtered by
  // region either. Now required at creation, same as the identity fields above.
  if (!body?.need?.region) {
    return NextResponse.json({ error: 'Region is required' }, { status: 400 });
  }

  const needProjectTypes = (body?.need?.project_types ?? []).filter(t => (PROJECT_TYPES as string[]).includes(t));
  const needScopeTypes = (body?.need?.scope_types ?? []).filter(t => (SCOPE_TYPES as string[]).includes(t));
  const needTiming = body?.need?.timing && (TIMINGS as string[]).includes(body.need.timing) ? body.need.timing : null;
  if (needTiming === 'contact_later' && !body?.need?.target_contact_date) {
    return NextResponse.json({ error: '"Contact later" requires a target contact date' }, { status: 400 });
  }
  if (body?.need?.region && !REGION_CODES.includes(body.need.region)) {
    return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
  }
  if (body?.need?.service_line && !SERVICE_LINE_VALUES.includes(body.need.service_line)) {
    return NextResponse.json({ error: 'Invalid service line' }, { status: 400 });
  }

  const assignedTo = role === 'marketing_pr' ? user.id : (body?.assigned_marketing_user_id?.trim() || null);
  const ownerId = body?.owner_id?.trim() || user.id;

  const { data, error } = await admin.from('prospects').insert({
    entity_type: entityType,
    organization_name: organizationName,
    person_name: personName,
    brand_name:    body?.brand_name?.trim()    || null,
    industry:       body?.industry?.trim()      || null,
    website:        body?.website?.trim()       || null,
    main_email:     body?.main_email?.trim()    || null,
    main_phone:     body?.main_phone?.trim()    || null,
    company_size:   body?.company_size?.trim()  || null,
    location_count: body?.location_count ?? null,
    source_label:   body?.source_label?.trim()  || null,
    source_raw_label: body?.source_raw_label?.trim() || null,
    tags: body?.tags ?? [],
    status: 'captured',
    region: body.need!.region,
    regions: [body.need!.region],
    owner_id: ownerId,
    assigned_marketing_user_id: assignedTo,
    created_by: user.id,
  }).select(LIST_COLS).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body?.contact?.name?.trim()) {
    await admin.from('prospect_contacts').insert({
      prospect_id: data.id,
      name: body.contact.name.trim(),
      title: body.contact.title?.trim() || null,
      email: body.contact.email?.trim() || null,
      phone: body.contact.phone?.trim() || null,
      is_decision_maker: body.contact.is_decision_maker === true,
      preferred_contact_method: body.contact.preferred_contact_method?.trim() || null,
      is_primary: true,
      created_by: user.id,
    });
  }
  if (body?.additionalContact?.name?.trim()) {
    await admin.from('prospect_contacts').insert({
      prospect_id: data.id,
      name: body.additionalContact.name.trim(),
      title: body.additionalContact.title?.trim() || null,
      email: body.additionalContact.email?.trim() || null,
      phone: body.additionalContact.phone?.trim() || null,
      is_decision_maker: body.additionalContact.is_decision_maker === true,
      preferred_contact_method: body.additionalContact.preferred_contact_method?.trim() || null,
      is_primary: false,
      created_by: user.id,
    });
  }
  let firstLocationId: string | null = null;
  if (body?.location?.city?.trim() || body?.location?.state?.trim()) {
    const { data: locationRow } = await admin.from('prospect_locations').insert({
      prospect_id: data.id,
      city: body.location.city?.trim() || null,
      state: body.location.state?.trim() || null,
      country: body.location.country?.trim() || null,
      is_active: body.location.is_active !== false,
    }).select('id').single();
    firstLocationId = locationRow?.id ?? null;
  }

  const duplicates = await findProspectDuplicates(admin, {
    organizationName, personName, website: body?.website, email: body?.main_email, phone: body?.main_phone,
  }, data.id);

  let need = null;
  let sync: Awaited<ReturnType<typeof runClassificationForNeed>> | null = null;
  if (body?.need) {
    const { data: needRow } = await admin.from('prospect_needs').insert({
      prospect_id: data.id,
      location_id: firstLocationId,
      title: body.need.title?.trim() || 'Initial project need',
      description: body.need.description?.trim() || null,
      has_active_project: body.need.has_active_project ?? null,
      project_types: needProjectTypes,
      scope_types: needScopeTypes,
      deadline: body.need.deadline || null,
      expected_start_date: body.need.expected_start_date || null,
      layout_available: body.need.layout_available ?? null,
      site_ready: body.need.site_ready ?? null,
      timing: needTiming,
      target_contact_date: body.need.target_contact_date || null,
      source: body?.source_label?.trim() || null,
      region: body.need.region || null,
      service_line: body.need.service_line || null,
      state: body.need.state?.trim() || null,
      created_by: user.id,
    }).select().single();
    need = needRow;
    if (needRow) sync = await runClassificationForNeed(admin, needRow.id, user.id);
  }
  const { data: finalProspect } = await admin.from('prospects').select(LIST_COLS).eq('id', data.id).single();

  await logAudit({
    actorId: user.id, action: 'prospect.created', resource: `prospect:${data.id}`,
    newValue: { display_name: data.display_name, entity_type: entityType, status: finalProspect?.status ?? data.status },
  });
  if (sync?.opportunityAction === 'created') {
    await logAudit({ actorId: user.id, action: 'opportunity.auto_created', resource: `opportunity:${sync.opportunity?.id}`, newValue: { prospect_id: data.id, need_id: need?.id, reasons: sync.classification.reasons } });
  }
  if (sync?.potentialAction === 'created') {
    await logAudit({ actorId: user.id, action: 'potential.auto_created', resource: `potential:${sync.potential?.id}`, newValue: { prospect_id: data.id, need_id: need?.id, reasons: sync.classification.reasons } });
  }
  return NextResponse.json({
    prospect: finalProspect ?? data, duplicates, need,
    classification: sync?.classification ?? null, opportunity: sync?.opportunity ?? null, potential: sync?.potential ?? null,
  }, { status: 201 });
}
