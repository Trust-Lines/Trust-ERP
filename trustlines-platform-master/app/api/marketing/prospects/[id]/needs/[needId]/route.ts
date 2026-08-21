import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_READ_ROLES, MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';
import { PROJECT_TYPES, SCOPE_TYPES, TIMINGS } from '@/lib/marketing/classification';
import { runClassificationForNeed } from '@/lib/marketing/opportunityEngine';
import { REGION_CODES, SERVICE_LINE_VALUES } from '@/lib/regions';

type Params = { params: Promise<{ id: string; needId: string }> };

const NEED_COLS = 'id, prospect_id, location_id, title, description, has_active_project, project_types, scope_types, '
  + 'deadline, expected_start_date, layout_available, site_ready, budget_min, budget_max, currency, timing, '
  + 'target_contact_date, source, status, classification, classification_reasons, classification_rule_version, '
  + 'region, service_line, state, project_id, created_by, created_at, updated_at';

const EDITABLE = [
  'title', 'description', 'location_id', 'project_types', 'scope_types',
  'has_active_project', 'deadline', 'expected_start_date', 'layout_available', 'site_ready',
  'budget_min', 'budget_max', 'currency', 'timing', 'target_contact_date', 'source',
  'region', 'service_line', 'state',
] as const;

const CLASSIFICATION_INPUT_KEYS = [
  'project_types', 'has_active_project', 'deadline', 'expected_start_date', 'timing', 'layout_available',
] as const;

export async function GET(_req: NextRequest, { params }: Params) {
  const { id, needId } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data, error } = await admin.from('prospect_needs').select(NEED_COLS)
    .eq('id', needId).eq('prospect_id', id).is('deleted_at', null).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ need: data });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, needId } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) patch[k] = body[k];

  if ('project_types' in patch && !(Array.isArray(patch.project_types) && patch.project_types.every(t => (PROJECT_TYPES as string[]).includes(t)))) {
    return NextResponse.json({ error: 'Invalid project type' }, { status: 400 });
  }
  if ('scope_types' in patch && !(Array.isArray(patch.scope_types) && patch.scope_types.every(t => (SCOPE_TYPES as string[]).includes(t)))) {
    return NextResponse.json({ error: 'Invalid scope type' }, { status: 400 });
  }
  if ('timing' in patch && patch.timing != null && !(TIMINGS as string[]).includes(patch.timing as string)) {
    return NextResponse.json({ error: 'Invalid timing' }, { status: 400 });
  }
  if ('region' in patch && patch.region != null && !REGION_CODES.includes(patch.region as string)) {
    return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
  }
  if ('service_line' in patch && patch.service_line != null && !SERVICE_LINE_VALUES.includes(patch.service_line as string)) {
    return NextResponse.json({ error: 'Invalid service line' }, { status: 400 });
  }
  if ('timing' in patch || 'target_contact_date' in patch) {
    const { data: current } = await admin.from('prospect_needs').select('timing, target_contact_date').eq('id', needId).maybeSingle();
    const effectiveTiming = 'timing' in patch ? patch.timing : current?.timing;
    const effectiveDate = 'target_contact_date' in patch ? patch.target_contact_date : current?.target_contact_date;
    if (effectiveTiming === 'contact_later' && !effectiveDate) {
      return NextResponse.json({ error: '"Contact later" requires a target contact date' }, { status: 400 });
    }
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('prospect_needs').update(patch)
    .eq('id', needId).eq('prospect_id', id).is('deleted_at', null).select(NEED_COLS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'need.updated', resource: `prospect_need:${needId}`, newValue: patch });

  let finalNeed = data;
  let sync = null;
  if (CLASSIFICATION_INPUT_KEYS.some(k => k in patch)) {
    sync = await runClassificationForNeed(admin, needId, user.id);
    const { data: refreshed } = await admin.from('prospect_needs').select(NEED_COLS).eq('id', needId).maybeSingle();
    finalNeed = refreshed ?? data;
    if (sync.opportunityAction !== 'none') {
      await logAudit({
        actorId: user.id, action: `opportunity.auto_${sync.opportunityAction}`,
        resource: `opportunity:${sync.opportunity?.id}`, newValue: { prospect_id: id, need_id: needId, reasons: sync.classification.reasons },
      });
    }
    if (sync.potentialAction !== 'none') {
      await logAudit({
        actorId: user.id, action: `potential.auto_${sync.potentialAction}`,
        resource: `potential:${sync.potential?.id}`, newValue: { prospect_id: id, need_id: needId, reasons: sync.classification.reasons },
      });
    }
  }

  return NextResponse.json({ need: finalNeed, classification: sync?.classification ?? null, opportunity: sync?.opportunity ?? null, potential: sync?.potential ?? null });
}
