import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_ROLES } from '@/lib/marketing/roles';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { assertPotentialAccess } from '@/lib/marketing/potentialAccess';

type Params = { params: Promise<{ id: string }> };

const ALLOWED_ROLES = [...SALES_HANDOFF_ROLES, ...MARKETING_ROLES];

const DETAIL_COLS = 'id, need_id, prospect_id, primary_contact_id, title, potential_type, status, region, priority, '
  + 'estimated_start_date, target_contact_date, estimated_quantity, estimated_value, currency, confidence, '
  + 'assigned_to, converted_opportunity_id, auto_managed, classification_reasons, classification_rule_version, notes, '
  + 'external_stage_label, state, formatted_address, brand, business_types, industry_raw, project_type_raw, '
  + 'request_raw, to_do_raw, direct_contact_raw, source_raw_label, tags, external_created_at, source_description_raw, '
  + 'due_date, date_done, deposit, payment_raw, targeted, created_by, created_at, updated_at';

const EDITABLE = [
  'notes', 'priority', 'assigned_to', 'estimated_value', 'currency', 'confidence',
  'target_contact_date', 'estimated_start_date', 'primary_contact_id', 'region', 'status',
  'tags',
  'industry_raw',
  'to_do_raw', 'request_raw', 'project_type_raw', 'source_raw_label', 'targeted',
  'external_stage_label',
  'direct_contact_raw', 'state', 'formatted_address', 'brand', 'business_types',
  'deposit', 'payment_raw', 'due_date', 'date_done',
] as const;

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(ALLOWED_ROLES);
  if (deny) return deny;
  const denied = await assertPotentialAccess(admin, id, user.id, role, 'read');
  if (denied) return denied;

  const { data, error } = await admin.from('prospect_potentials').select(DETAIL_COLS).eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [prospectRes, contactsRes, notesRes, filesRes, needRes] = await Promise.all([
    admin.from('prospects').select('display_name, industry, brand_name').eq('id', data.prospect_id).maybeSingle(),
    admin.from('prospect_contacts').select('id, name').eq('prospect_id', data.prospect_id).order('is_primary', { ascending: false }),
    admin.from('need_notes').select('id, author_name, author_id, body, image_path, link_url, link_title, link_thumbnail_url, source_created_at, created_at')
      .eq('need_id', data.need_id).order('source_created_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }),
    admin.from('need_files').select('id, dropbox_path, file_name, uploaded_by, created_at').eq('need_id', data.need_id).order('created_at', { ascending: false }),
    // Timing/has_active_project/expected_start_date only ever live on the Need, never
    // copied onto the Potential row itself (no columns for them there) — fetched read-only
    // so the UI can show the real submitted answers instead of just the composed notes text.
    admin.from('prospect_needs').select('timing, has_active_project, expected_start_date, layout_available').eq('id', data.need_id).maybeSingle(),
  ]);

  return NextResponse.json({
    potential: data,
    prospect: prospectRes.data ?? null,
    contacts: contactsRes.data ?? [],
    notes: notesRes.data ?? [],
    files: filesRes.data ?? [],
    need: needRes.data ?? null,
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(ALLOWED_ROLES);
  if (deny) return deny;
  const denied = await assertPotentialAccess(admin, id, user.id, role);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) patch[k] = body[k];
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('prospect_potentials').update(patch).eq('id', id).is('deleted_at', null)
    .select(DETAIL_COLS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'potential.updated', resource: `potential:${id}`, newValue: patch });
  return NextResponse.json({ potential: data });
}
