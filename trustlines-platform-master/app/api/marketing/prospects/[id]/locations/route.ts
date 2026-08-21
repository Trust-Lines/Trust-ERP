import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';

type Params = { params: Promise<{ id: string }> };

const LOCATION_COLS = 'id, prospect_id, location_name, address_line_1, address_line_2, city, state, '
  + 'postal_code, country, location_type, is_active, store_status, estimated_remodel_date, notes, mailing_address, created_at';

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data: parent } = await admin.from('prospects').select('id').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!parent) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });

  const body = await req.json().catch(() => null) as {
    location_name?: string; address_line_1?: string; address_line_2?: string; city?: string;
    state?: string; postal_code?: string; country?: string; location_type?: string;
    is_active?: boolean; store_status?: string; estimated_remodel_date?: string; notes?: string; mailing_address?: string;
  } | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { data, error } = await admin.from('prospect_locations').insert({
    prospect_id: id,
    location_name:  body.location_name?.trim()  || null,
    address_line_1: body.address_line_1?.trim() || null,
    address_line_2: body.address_line_2?.trim() || null,
    city:           body.city?.trim()           || null,
    state:          body.state?.trim()           || null,
    postal_code:    body.postal_code?.trim()    || null,
    country:        body.country?.trim()         || null,
    location_type:  body.location_type?.trim()  || null,
    is_active: body.is_active !== false,
    store_status: body.store_status?.trim() || null,
    estimated_remodel_date: body.estimated_remodel_date || null,
    notes: body.notes?.trim() || null,
    mailing_address: body.mailing_address?.trim() || null,
  }).select(LOCATION_COLS).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'prospect_location.created', resource: `prospect_location:${data.id}`, newValue: { prospect_id: id, city: body.city } });
  return NextResponse.json({ location: data }, { status: 201 });
}
