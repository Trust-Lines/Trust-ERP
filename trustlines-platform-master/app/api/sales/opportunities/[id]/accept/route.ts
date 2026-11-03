import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { acceptOpportunity, HandoffError } from '@/lib/marketing/salesHandoff';

type Params = { params: Promise<{ id: string }> };

// Sales takes the Opportunity on. The project opens later, when the deal is won (close-won).
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(SALES_HANDOFF_ROLES);
  if (deny) return deny;

  try {
    return NextResponse.json(await acceptOpportunity(admin, id, user.id));
  } catch (e) {
    if (e instanceof HandoffError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
