import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';

type Params = { params: Promise<{ id: string; locationId: string }> };

const LOCATION_COLS = 'id, prospect_id, location_name, address_line_1, address_line_2, city, state, '
  + 'postal_code, country, location_type, is_active, store_status, estimated_remodel_date, notes, mailing_address, created_at';

const EDITABLE = [
  'location_name', 'address_line_1', 'address_line_2', 'city', 'state', 'postal_code',
  'country', 'location_type', 'is_active', 'store_status', 'estimated_remodel_date', 'notes', 'mailing_address',
] as const;

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, locationId } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) patch[k] = body[k];
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('prospect_locations').update(patch)
    .eq('id', locationId).eq('prospect_id', id).select(LOCATION_COLS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Location not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'prospect_location.updated', resource: `prospect_location:${locationId}`, newValue: patch });
  return NextResponse.json({ location: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, locationId } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data, error } = await admin.from('prospect_locations')
    .delete().eq('id', locationId).eq('prospect_id', id).select('id, city').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Location not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'prospect_location.deleted', resource: `prospect_location:${locationId}`, newValue: { prospect_id: id, city: data.city } });
  return NextResponse.json({ ok: true });
}
