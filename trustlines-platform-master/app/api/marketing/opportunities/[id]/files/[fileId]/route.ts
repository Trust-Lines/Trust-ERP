import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_ROLES } from '@/lib/marketing/roles';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { assertOpportunityAccess } from '@/lib/marketing/opportunityAccess';

const ALLOWED_ROLES = [...SALES_HANDOFF_ROLES, ...MARKETING_ROLES];

type Params = { params: Promise<{ id: string; fileId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, fileId } = await params;
  const { user, role, admin, deny } = await requireRole(ALLOWED_ROLES);
  if (deny) return deny;
  const denied = await assertOpportunityAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data: opp } = await admin.from('opportunities').select('need_id').eq('id', id).maybeSingle();
  if (!opp?.need_id) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  const { data, error } = await admin.from('need_files').delete()
    .eq('id', fileId).eq('need_id', opp.need_id).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'opportunity_file.deleted', resource: `need_files:${fileId}` });
  return NextResponse.json({ ok: true });
}
