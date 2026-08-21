import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { canAccessProspect } from '@/lib/marketing/prospectAccess';
import { initiateHandoff, HandoffError } from '@/lib/marketing/salesHandoff';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  const { data: opp } = await admin.from('opportunities').select('prospect_id').eq('id', id).maybeSingle();
  if (!opp || !(await canAccessProspect(admin, opp.prospect_id, user.id, role))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({})) as { sales_owner_id?: string };

  try {
    const opportunity = await initiateHandoff(admin, id, user.id, body.sales_owner_id?.trim() || null);
    return NextResponse.json({ opportunity });
  } catch (e) {
    if (e instanceof HandoffError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
