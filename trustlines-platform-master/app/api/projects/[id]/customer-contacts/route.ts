import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { PROJECT_CONTACT_READ_ROLES, PROJECT_CONTACT_WRITE_ROLES } from '@/lib/customers/roles';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { admin, deny } = await requireRole(PROJECT_CONTACT_READ_ROLES);
  if (deny) return deny;

  const linkRes = await admin.from('project_customer_contacts')
    .select('id, customer_contact_id, role_on_project, is_primary, created_at')
    .eq('project_id', id);
  if (linkRes.error) return NextResponse.json({ links: [], contacts: [], available: [] });
  const links = linkRes.data ?? [];

  const contactIds = links.map((l: { customer_contact_id: string }) => l.customer_contact_id);
  let contacts: unknown[] = [];
  if (contactIds.length) {
    const { data } = await admin.from('customer_contacts')
      .select('id, name, title, role_type, email, phone, is_primary')
      .in('id', contactIds).is('deleted_at', null);
    contacts = data ?? [];
  }

  let available: unknown[] = [];
  const { data: proj } = await admin.from('projects').select('customer_id').eq('id', id).maybeSingle();
  const customerId = (proj as { customer_id?: string | null } | null)?.customer_id ?? null;
  if (customerId) {
    const { data } = await admin.from('customer_contacts')
      .select('id, name, title, role_type, email, phone')
      .eq('customer_id', customerId).is('deleted_at', null).order('is_primary', { ascending: false }).order('name');
    available = (data ?? []).filter((c: { id: string }) => !contactIds.includes(c.id));
  }

  return NextResponse.json({ links, contacts, available, customerId });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(PROJECT_CONTACT_WRITE_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as { customerContactId?: string; roleOnProject?: string; isPrimary?: boolean } | null;
  const contactId = body?.customerContactId;
  if (!contactId) return NextResponse.json({ error: 'customerContactId is required' }, { status: 400 });

  const { data: proj } = await admin.from('projects').select('customer_id').eq('id', id).maybeSingle();
  const customerId = (proj as { customer_id?: string | null } | null)?.customer_id ?? null;
  if (!customerId) return NextResponse.json({ error: 'Link a customer to this project first' }, { status: 400 });

  const { data: contact } = await admin.from('customer_contacts')
    .select('id, customer_id').eq('id', contactId).is('deleted_at', null).maybeSingle();
  if (!contact || contact.customer_id !== customerId) {
    return NextResponse.json({ error: 'Contact does not belong to this project’s customer' }, { status: 400 });
  }

  if (body?.isPrimary === true) {
    await admin.from('project_customer_contacts').update({ is_primary: false }).eq('project_id', id).eq('is_primary', true);
  }

  const { data, error } = await admin.from('project_customer_contacts').insert({
    project_id: id, customer_contact_id: contactId,
    role_on_project: body?.roleOnProject?.trim() || null, is_primary: body?.isPrimary === true, created_by: user.id,
  }).select('id, customer_contact_id, role_on_project, is_primary, created_at').single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Contact already attached' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({ actorId: user.id, action: 'project_customer_contact.attached', projectId: id, resource: `project_customer_contact:${data.id}`, newValue: { contactId } });
  return NextResponse.json({ link: data }, { status: 201 });
}
