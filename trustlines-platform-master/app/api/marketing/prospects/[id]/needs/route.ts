import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_READ_ROLES, MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';
import { PROJECT_TYPES, SCOPE_TYPES, TIMINGS } from '@/lib/marketing/classification';
import { runClassificationForNeed } from '@/lib/marketing/opportunityEngine';
import { REGION_CODES, SERVICE_LINE_VALUES } from '@/lib/regions';

type Params = { params: Promise<{ id: string }> };

const NEED_COLS = 'id, prospect_id, location_id, title, description, has_active_project, project_types, scope_types, '
  + 'deadline, expected_start_date, layout_available, site_ready, budget_min, budget_max, currency, timing, '
  + 'target_contact_date, source, status, classification, classification_reasons, classification_rule_version, '
  + 'region, service_line, state, project_id, created_by, created_at, updated_at';

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data, error } = await admin.from('prospect_needs').select(NEED_COLS)
    .eq('prospect_id', id).is('deleted_at', null).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ needs: data ?? [] });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as {
    title?: string; description?: string; location_id?: string;
    project_types?: string[]; scope_types?: string[];
    has_active_project?: boolean; deadline?: string; expected_start_date?: string;
    layout_available?: boolean; site_ready?: boolean;
    budget_min?: number; budget_max?: number; currency?: string;
    timing?: string; target_contact_date?: string; source?: string;
    region?: string; service_line?: string; state?: string;
  } | null;
  if (!body?.title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  const projectTypes = (body.project_types ?? []).filter(t => (PROJECT_TYPES as string[]).includes(t));
  const scopeTypes = (body.scope_types ?? []).filter(t => (SCOPE_TYPES as string[]).includes(t));
  const timing = body.timing && (TIMINGS as string[]).includes(body.timing) ? body.timing : null;
  if (timing === 'contact_later' && !body.target_contact_date) {
    return NextResponse.json({ error: '"Contact later" requires a target contact date' }, { status: 400 });
  }
  if (body.region && !REGION_CODES.includes(body.region)) return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
  if (body.service_line && !SERVICE_LINE_VALUES.includes(body.service_line)) return NextResponse.json({ error: 'Invalid service line' }, { status: 400 });

  const { data: need, error } = await admin.from('prospect_needs').insert({
    prospect_id: id,
    location_id: body.location_id?.trim() || null,
    title: body.title.trim(),
    description: body.description?.trim() || null,
    has_active_project: body.has_active_project ?? null,
    project_types: projectTypes,
    scope_types: scopeTypes,
    deadline: body.deadline || null,
    expected_start_date: body.expected_start_date || null,
    layout_available: body.layout_available ?? null,
    site_ready: body.site_ready ?? null,
    budget_min: body.budget_min ?? null,
    budget_max: body.budget_max ?? null,
    currency: body.currency?.trim() || null,
    timing,
    target_contact_date: body.target_contact_date || null,
    source: body.source?.trim() || null,
    region: body.region || null,
    service_line: body.service_line || null,
    state: body.state?.trim() || null,
    created_by: user.id,
  }).select(NEED_COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sync = await runClassificationForNeed(admin, need.id, user.id);
  const { data: finalNeed } = await admin.from('prospect_needs').select(NEED_COLS).eq('id', need.id).single();

  await logAudit({ actorId: user.id, action: 'need.created', resource: `prospect_need:${need.id}`, newValue: { prospect_id: id, title: need.title } });
  if (sync.opportunityAction === 'created') {
    await logAudit({ actorId: user.id, action: 'opportunity.auto_created', resource: `opportunity:${sync.opportunity?.id}`, newValue: { prospect_id: id, need_id: need.id, reasons: sync.classification.reasons } });
  }
  if (sync.potentialAction === 'created') {
    await logAudit({ actorId: user.id, action: 'potential.auto_created', resource: `potential:${sync.potential?.id}`, newValue: { prospect_id: id, need_id: need.id, reasons: sync.classification.reasons } });
  }

  return NextResponse.json({
    need: finalNeed ?? need, classification: sync.classification,
    opportunity: sync.opportunity, potential: sync.potential,
  }, { status: 201 });
}
