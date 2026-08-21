import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_INTAKE_ROLES } from '@/lib/sales/roles';

export async function GET() {
  const { admin, deny } = await requireRole(SALES_INTAKE_ROLES);
  if (deny) return deny;

  const { data, error } = await admin.rpc('peek_global_number');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ nextNumber: (data as number) ?? 1 });
}
