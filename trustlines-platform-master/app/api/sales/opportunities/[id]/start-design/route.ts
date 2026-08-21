import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { ensureDesignJobForOpportunity } from '@/lib/marketing/design';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(SALES_HANDOFF_ROLES);
  if (deny) return deny;

  const { data: opp } = await admin.from('opportunities').select('id, stage').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (opp.stage !== 'sales_accepted') {
    return NextResponse.json({ error: `Cannot start Design for an Opportunity in stage "${opp.stage}" — it must be Sales Accepted` }, { status: 409 });
  }

  const result = await ensureDesignJobForOpportunity(admin, id, user.id);
  if (!result.jobId) return NextResponse.json({ error: 'Failed to start Design' }, { status: 500 });
  return NextResponse.json(result);
}
