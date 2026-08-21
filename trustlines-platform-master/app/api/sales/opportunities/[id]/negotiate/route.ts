import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { logAudit } from '@/lib/audit/log';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(SALES_HANDOFF_ROLES);
  if (deny) return deny;

  const { data: opp } = await admin.from('opportunities').select('id, stage').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (opp.stage !== 'proposal') {
    return NextResponse.json({ error: `Cannot move to Negotiation from stage "${opp.stage}" — a proposal must be presented first` }, { status: 409 });
  }

  const { data: updated } = await admin.from('opportunities').update({ stage: 'negotiation' })
    .eq('id', id).select('id, stage').maybeSingle();
  await logAudit({ actorId: user.id, action: 'opportunity.negotiation', resource: `opportunity:${id}` });
  return NextResponse.json({ opportunity: updated });
}
