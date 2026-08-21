import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_INTAKE_ROLES } from '@/lib/sales/roles';
import { assertLeadAccess } from '@/lib/sales/leadAccess';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(SALES_INTAKE_ROLES);
  if (deny) return deny;
  const denied = await assertLeadAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { error } = await admin.from('lead_intake')
    .update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
