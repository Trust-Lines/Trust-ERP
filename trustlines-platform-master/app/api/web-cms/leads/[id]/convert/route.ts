import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { logAudit } from '@/lib/audit/log';
import { normalizeEmail } from '@/lib/marketing/duplicates';

type Params = { params: Promise<{ id: string }> };

// Turns a website lead into a Marketing Contact (prospect) — either a NEW one, or by attaching
// to an EXISTING one the marketer picked after seeing the duplicate suggestions. Never automatic.
export async function POST(req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const { id } = await params;
  const b = (await req.json().catch(() => null)) as { prospectId?: unknown } | null;

  const { data: lead } = await admin.from('web_leads').select('*').eq('id', id).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (lead.status === 'converted' && lead.prospect_id) return NextResponse.json({ error: 'Already converted', prospectId: lead.prospect_id }, { status: 409 });
  if (lead.kind === 'newsletter') return NextResponse.json({ error: 'Newsletter signups are not converted to Contacts' }, { status: 400 });

  let prospectId: string;
  let created = false;

  if (typeof b?.prospectId === 'string' && b.prospectId) {
    const { data: existing } = await admin.from('prospects').select('id').eq('id', b.prospectId).is('deleted_at', null).maybeSingle();
    if (!existing) return NextResponse.json({ error: 'That Contact no longer exists' }, { status: 404 });
    prospectId = existing.id;
  } else {
    const isOrg = !!lead.company;
    const { data: p, error } = await admin.from('prospects').insert({
      entity_type: isOrg ? 'organization' : 'person',
      organization_name: isOrg ? lead.company : null,
      person_name: isOrg ? null : lead.name,
      main_email: lead.email, main_phone: lead.phone,
      source_label: 'website', source_raw_label: 'Website contact form',
      status: 'captured', created_by: user.id,
    }).select('id').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    prospectId = p.id;
    created = true;
  }

  // Contact person: skip when an existing contact already has the same email.
  if (lead.name && (lead.email || lead.phone) && (lead.company || !created)) {
    const { data: contacts } = await admin.from('prospect_contacts').select('email').eq('prospect_id', prospectId);
    const email = normalizeEmail(lead.email);
    const already = !!email && (contacts ?? []).some((c: { email: string | null }) => normalizeEmail(c.email) === email);
    if (!already) {
      await admin.from('prospect_contacts').insert({
        prospect_id: prospectId, name: lead.name, email: lead.email, phone: lead.phone,
        is_primary: created, created_by: user.id,
      });
    }
  }

  if (lead.store_location) {
    await admin.from('prospect_locations').insert({
      prospect_id: prospectId, address_line_1: lead.store_location, location_type: lead.store_type,
      notes: [lead.store_condition && `Store condition: ${lead.store_condition}`, lead.message].filter(Boolean).join('\n') || null,
      is_active: true,
    });
  }

  await admin.from('web_leads').update({
    status: 'converted', prospect_id: prospectId, handled_by: user.id, handled_at: new Date().toISOString(),
  }).eq('id', id);

  await logAudit({
    actorId: user.id, action: created ? 'prospect.created_from_web_lead' : 'prospect.linked_from_web_lead',
    resource: `prospect:${prospectId}`, newValue: { web_lead: id },
  });
  return NextResponse.json({ prospectId, created });
}
