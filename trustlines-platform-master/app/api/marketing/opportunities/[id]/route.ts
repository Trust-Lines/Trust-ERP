import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { logLeadActivity } from '@/lib/sales/activity';
import { MARKETING_ROLES } from '@/lib/marketing/roles';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { assertOpportunityAccess } from '@/lib/marketing/opportunityAccess';
import { OPPORTUNITY_STAGE_LABEL } from '@/lib/marketing/classification';
import type { OpportunityStage } from '@/types/database';

type Params = { params: Promise<{ id: string }> };

const ALLOWED_ROLES = [...SALES_HANDOFF_ROLES, ...MARKETING_ROLES];

const STAGES = Object.keys(OPPORTUNITY_STAGE_LABEL) as OpportunityStage[];

const DETAIL_COLS = 'id, prospect_id, customer_id, primary_contact_id, project_id, need_id, title, description, opportunity_type, '
  + 'project_types, stage, priority, region, source_label, marketing_owner_id, sales_owner_id, estimated_location_count, '
  + 'estimated_value, currency, probability, expected_close_date, deadline, urgency, budget_status, '
  + 'decision_maker_status, next_action, next_action_date, sales_handoff_at, sales_accepted_at, closed_at, '
  + 'closed_reason, auto_managed, classification_reasons, classification_rule_version, admin_corrected, '
  + 'admin_correction_reason, external_stage_label, state, formatted_address, brand, business_types, industry_raw, '
  + 'project_type_raw, request_raw, to_do_raw, direct_contact_raw, source_raw_label, tags, external_created_at, '
  + 'source_description_raw, created_by, created_at, updated_at';

const EDITABLE = [
  'description', 'priority', 'marketing_owner_id', 'sales_owner_id', 'estimated_location_count',
  'estimated_value', 'currency', 'probability', 'expected_close_date', 'urgency',
  'budget_status', 'decision_maker_status', 'primary_contact_id', 'deadline',
  'region',
  'tags',
  'industry_raw',
  'to_do_raw', 'request_raw', 'project_type_raw', 'source_raw_label', 'targeted',
] as const;

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(ALLOWED_ROLES);
  if (deny) return deny;
  const denied = await assertOpportunityAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data, error } = await admin.from('opportunities').select(DETAIL_COLS).eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [prospectRes, contactsRes, projectRes, notesRes, filesRes] = await Promise.all([
    admin.from('prospects').select('display_name, industry, brand_name').eq('id', data.prospect_id).maybeSingle(),
    admin.from('prospect_contacts').select('id, name').eq('prospect_id', data.prospect_id).order('is_primary', { ascending: false }),
    data.project_id
      ? admin.from('projects').select('code, dropbox_root_path').eq('id', data.project_id).maybeSingle()
      : Promise.resolve({ data: null }),
    data.need_id
      ? admin.from('need_notes').select('id, author_name, author_id, body, image_path, link_url, link_title, link_thumbnail_url, source_created_at, created_at')
          .eq('need_id', data.need_id).order('source_created_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true })
      : Promise.resolve({ data: [] }),
    data.need_id
      ? admin.from('need_files').select('id, dropbox_path, file_name, uploaded_by, created_at').eq('need_id', data.need_id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  return NextResponse.json({
    opportunity: data,
    prospect: prospectRes.data ?? null,
    contacts: contactsRes.data ?? [],
    project: projectRes.data ?? null,
    notes: notesRes.data ?? [],
    files: filesRes.data ?? [],
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(ALLOWED_ROLES);
  if (deny) return deny;
  const denied = await assertOpportunityAccess(admin, id, user.id, role);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) patch[k] = body[k];

  let stageChanged = false;
  let stageReason = '';
  if (typeof body.stage === 'string') {
    if (!STAGES.includes(body.stage as OpportunityStage)) {
      return NextResponse.json({ error: 'Invalid stage' }, { status: 400 });
    }
    stageReason = typeof body.admin_correction_reason === 'string' ? body.admin_correction_reason.trim() : '';
    if (!stageReason) {
      return NextResponse.json({ error: 'A reason is required to manually move an Opportunity’s stage' }, { status: 400 });
    }
    patch.stage = body.stage;
    patch.admin_corrected = true;
    patch.admin_correction_reason = stageReason;
    stageChanged = true;
  }

  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('opportunities').update(patch).eq('id', id).is('deleted_at', null)
    .select(DETAIL_COLS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'opportunity.updated', resource: `opportunity:${id}`, newValue: patch });
  if (stageChanged) {
    await logLeadActivity(admin, {
      opportunityId: id, actorId: user.id, kind: 'change',
      body: `moved to "${OPPORTUNITY_STAGE_LABEL[body.stage as OpportunityStage]}" — ${stageReason}`,
    });
  }
  return NextResponse.json({ opportunity: data });
}
