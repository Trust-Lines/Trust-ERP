import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { acceptOpportunity, HandoffError } from '@/lib/marketing/salesHandoff';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(SALES_HANDOFF_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as {
    region?: string; service_line?: string; city?: string; street?: string; state?: string; customer_name?: string;
  } | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  try {
    const result = await acceptOpportunity(admin, id, user.id, {
      region: body.region ?? '', serviceLine: body.service_line ?? '',
      city: body.city ?? '', street: body.street, state: body.state ?? '',
      customerName: body.customer_name ?? '',
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof HandoffError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
