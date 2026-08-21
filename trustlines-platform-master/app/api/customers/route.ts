import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { CUSTOMER_READ_ROLES, CUSTOMER_WRITE_ROLES } from '@/lib/customers/roles';

const LIST_COLS = 'id, name, code, industry, email, phone, status, is_archived, created_at';

export async function GET(req: NextRequest) {
  const { admin, deny } = await requireRole(CUSTOMER_READ_ROLES);
  if (deny) return deny;

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const status = (url.searchParams.get('status') ?? '').trim();
  const includeArchived = url.searchParams.get('includeArchived') === '1';

  let query = admin.from('customers').select(LIST_COLS).is('deleted_at', null);
  if (!includeArchived) query = query.eq('is_archived', false);
  if (status) query = query.eq('status', status);
  if (q) {
    const safe = q.replace(/[%,()\\]/g, '\\$&');
    query = query.or(`name.ilike.%${safe}%,code.ilike.%${safe}%,industry.ilike.%${safe}%`);
  }
  query = query.order('name').limit(500);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ customers: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireRole(CUSTOMER_WRITE_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as {
    name?: string; code?: string; industry?: string; email?: string;
    phone?: string; website?: string; tax_id?: string; status?: string; notes?: string;
  } | null;
  const name = body?.name?.trim();
  if (!name) return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });

  const safeName = name.replace(/[%,()\\]/g, '\\$&');
  const { data: dup } = await admin.from('customers')
    .select('id').is('deleted_at', null).ilike('name', safeName).limit(1);
  if (dup && dup.length) {
    return NextResponse.json({ error: `A customer named "${name}" already exists`, duplicateId: dup[0].id }, { status: 409 });
  }

  const status = ['active', 'inactive', 'prospect'].includes(body?.status ?? '') ? body!.status : 'active';
  const { data, error } = await admin.from('customers').insert({
    name,
    code:     body?.code?.trim()     || null,
    industry: body?.industry?.trim() || null,
    email:    body?.email?.trim()    || null,
    phone:    body?.phone?.trim()    || null,
    website:  body?.website?.trim()  || null,
    tax_id:   body?.tax_id?.trim()   || null,
    status,
    notes:    body?.notes?.trim()    || null,
    created_by: user.id,
  }).select('id, name, code, industry, email, phone, status, is_archived, created_at').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'customer.created', resource: `customer:${data.id}`, newValue: { name, status } });
  return NextResponse.json({ customer: data }, { status: 201 });
}
