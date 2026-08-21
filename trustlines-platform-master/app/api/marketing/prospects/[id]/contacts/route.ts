import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';

type Params = { params: Promise<{ id: string }> };

const CONTACT_COLS = 'id, prospect_id, name, title, role_type, email, phone, linkedin_url, preferred_contact_method, '
  + 'is_decision_maker, is_primary, contact_consent, notes, other_contact, whatsapp, company2_phone, created_at';

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data: parent } = await admin.from('prospects').select('id').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!parent) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });

  const body = await req.json().catch(() => null) as {
    name?: string; title?: string; role_type?: string; email?: string; phone?: string;
    linkedin_url?: string; preferred_contact_method?: string; is_decision_maker?: boolean; is_primary?: boolean;
    contact_consent?: boolean; notes?: string; other_contact?: string; whatsapp?: boolean; company2_phone?: string;
  } | null;
  const name = body?.name?.trim();
  if (!name) return NextResponse.json({ error: 'Contact name is required' }, { status: 400 });

  const isPrimary = body?.is_primary === true;
  if (isPrimary) {
    await admin.from('prospect_contacts').update({ is_primary: false }).eq('prospect_id', id).eq('is_primary', true);
  }

  const { data, error } = await admin.from('prospect_contacts').insert({
    prospect_id: id,
    name,
    title:        body?.title?.trim()        || null,
    role_type:    body?.role_type?.trim()    || null,
    email:        body?.email?.trim()        || null,
    phone:        body?.phone?.trim()        || null,
    linkedin_url: body?.linkedin_url?.trim() || null,
    preferred_contact_method: body?.preferred_contact_method?.trim() || null,
    is_decision_maker: body?.is_decision_maker === true,
    is_primary: isPrimary,
    contact_consent: body?.contact_consent === true,
    notes: body?.notes?.trim() || null,
    other_contact: body?.other_contact?.trim() || null,
    whatsapp: body?.whatsapp === true,
    company2_phone: body?.company2_phone?.trim() || null,
    created_by: user.id,
  }).select(CONTACT_COLS).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'prospect_contact.created', resource: `prospect_contact:${data.id}`, newValue: { prospect_id: id, name } });
  return NextResponse.json({ contact: data }, { status: 201 });
}
