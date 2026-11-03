import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { closeWon, HandoffError } from '@/lib/marketing/salesHandoff';

type Params = { params: Promise<{ id: string }> };

// The deal is won: opens its project (body = the project details, when it has none yet) and hands
// it over — T-Lines PM, Trust System, approved drawings (lib/marketing/salesHandoff).
// Body (optional): { region, service_line, city, street, state, customer_name }
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(SALES_HANDOFF_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as {
    region?: string; service_line?: string; city?: string; street?: string; state?: string; customer_name?: string;
  } | null;
  const input = body?.region ? {
    region: body.region, serviceLine: body.service_line ?? '', city: body.city ?? '',
    street: body.street, state: body.state ?? '', customerName: body.customer_name ?? '',
  } : undefined;

  try {
    const opportunity = await closeWon(admin, id, user.id, input);
    const { data: project } = opportunity?.project_id
      ? await admin.from('projects').select('id, code').eq('id', opportunity.project_id).maybeSingle()
      : { data: null };
    return NextResponse.json({ opportunity, project });
  } catch (e) {
    if (e instanceof HandoffError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
