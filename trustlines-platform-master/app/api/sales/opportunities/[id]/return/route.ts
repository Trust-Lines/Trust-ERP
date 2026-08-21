import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { returnOpportunity, HandoffError } from '@/lib/marketing/salesHandoff';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(SALES_HANDOFF_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => ({})) as { reason?: string };

  try {
    const opportunity = await returnOpportunity(admin, id, user.id, body.reason ?? '');
    return NextResponse.json({ opportunity });
  } catch (e) {
    if (e instanceof HandoffError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
