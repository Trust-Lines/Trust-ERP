import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { logLeadActivity } from '@/lib/sales/activity';
import { assertLeadAccess } from '@/lib/sales/leadAccess';
import { SALES_INTAKE_ROLES } from '@/lib/sales/roles';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(SALES_INTAKE_ROLES);
  if (deny) return deny;
  const denied = await assertLeadAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data: lead } = await admin.from('lead_intake')
    .select('id, customer_name, brand, customer_email, contact_person, contact_phone, industry')
    .eq('id', id).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { customerId?: string | null; create?: boolean };

  let customerId: string | null;
  let linkedCustomer: { id: string; name: string } | null = null;

  if (body.create) {
    const name = (lead.customer_name?.trim() || lead.brand?.trim() || '').trim();
    if (!name) return NextResponse.json({ error: 'Add a customer name or brand to the lead first' }, { status: 400 });

    const safeName = name.replace(/[%,()\\]/g, '\\$&');
    const { data: existing } = await admin.from('customers')
      .select('id, name').is('deleted_at', null).ilike('name', safeName).limit(1);

    if (existing && existing.length) {
      linkedCustomer = existing[0];
      customerId = existing[0].id;
    } else {
      const { data: created, error: cErr } = await admin.from('customers').insert({
        name,
        industry: lead.industry?.trim()       || null,
        email:    lead.customer_email?.trim()  || null,
        phone:    lead.contact_phone?.trim()   || null,
        status:   'prospect',
        created_by: user.id,
      }).select('id, name').single();
      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
      linkedCustomer = created;
      customerId = created.id;
      await logAudit({ actorId: user.id, action: 'customer.created', resource: `customer:${created.id}`, newValue: { name, from_lead: id } });

      if (lead.contact_person?.trim()) {
        await admin.from('customer_contacts').insert({
          customer_id: created.id, name: lead.contact_person.trim(),
          email: lead.customer_email?.trim() || null, phone: lead.contact_phone?.trim() || null,
          is_primary: true, created_by: user.id,
        });
      }
    }
  } else if (body.customerId === null) {
    customerId = null;
  } else if (typeof body.customerId === 'string') {
    const { data: cust } = await admin.from('customers').select('id, name, industry, email, phone').eq('id', body.customerId).is('deleted_at', null).maybeSingle();
    if (!cust) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    linkedCustomer = cust;
    customerId = cust.id;
  } else {
    return NextResponse.json({ error: 'Provide customerId or create:true' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { customer_id: customerId };
  if (customerId && linkedCustomer) {
    const c = linkedCustomer as { name: string; industry?: string | null; email?: string | null; phone?: string | null };
    if (!lead.customer_name?.trim() && c.name) patch.customer_name = c.name;
    if (!lead.industry?.trim() && c.industry) patch.industry = c.industry;
    if (!lead.customer_email?.trim() && c.email) patch.customer_email = c.email;
    if (!lead.contact_phone?.trim() && c.phone) patch.contact_phone = c.phone;

    if (!lead.contact_person?.trim()) {
      const { data: contact } = await admin.from('customer_contacts')
        .select('name, email, phone').eq('customer_id', customerId).is('deleted_at', null)
        .order('is_primary', { ascending: false }).limit(1).maybeSingle();
      const primary = contact as { name?: string; email?: string; phone?: string } | null;
      if (primary?.name) {
        patch.contact_person = primary.name;
        if (!lead.customer_email?.trim() && primary.email) patch.customer_email = primary.email;
        if (!lead.contact_phone?.trim() && primary.phone) patch.contact_phone = primary.phone;
      }
    }
  }

  const { error: upErr } = await admin.from('lead_intake').update(patch).eq('id', id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: customerId ? 'lead.customer_linked' : 'lead.customer_unlinked', projectId: null, resource: `lead:${id}`, newValue: { customerId } });
  await logLeadActivity(admin, { leadIntakeId: id, actorId: user.id, kind: 'change', body: customerId ? `linked customer ${linkedCustomer?.name ?? ''}`.trim() : 'unlinked customer' });

  return NextResponse.json({ ok: true, customer: linkedCustomer, customerId });
}
