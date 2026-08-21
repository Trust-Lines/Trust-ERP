import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_DELIVER_ROLES } from '@/lib/sales/roles';
import { assertLeadAccess } from '@/lib/sales/leadAccess';
import { deliverLeadToTrust } from '@/lib/sales/deliver';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(SALES_DELIVER_ROLES);
  if (deny) return deny;
  const denied = await assertLeadAccess(admin, id, user.id, role);
  if (denied) return denied;

  const res = await deliverLeadToTrust(admin, id, user.id);
  if (!res.ok) {
    const status = res.blocked === 'BLOCK1_INCOMPLETE' ? 400 : (res.error === 'Intake not found' ? 404 : 500);
    return NextResponse.json({ error: res.error }, { status });
  }
  return NextResponse.json(res);
}
