import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { closeWon, HandoffError } from '@/lib/marketing/salesHandoff';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(SALES_HANDOFF_ROLES);
  if (deny) return deny;

  try {
    const opportunity = await closeWon(admin, id, user.id);
    return NextResponse.json({ opportunity });
  } catch (e) {
    if (e instanceof HandoffError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
