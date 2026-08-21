import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_TEAM_ADMIN_ROLES } from '@/lib/sales/roles';

export async function POST(req: NextRequest) {
  const { admin, deny } = await requireRole(SALES_TEAM_ADMIN_ROLES);
  if (deny) return deny;

  const { userId, sales_region_id } = await req.json() as {
    userId?: string;
    sales_region_id?: string | null;
  };
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  const { data: target } = await admin.from('profiles').select('role').eq('id', userId).single();
  if (!target || (target as { role: string }).role !== 'sales_rep') {
    return NextResponse.json({ error: 'Target is not a sales_rep' }, { status: 400 });
  }

  const { error } = await admin.from('profiles')
    .update({ sales_region_id: sales_region_id ?? null })
    .eq('id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
