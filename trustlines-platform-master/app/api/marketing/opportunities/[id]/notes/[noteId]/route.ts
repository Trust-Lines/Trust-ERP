import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_ROLES } from '@/lib/marketing/roles';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { assertOpportunityAccess } from '@/lib/marketing/opportunityAccess';

const ALLOWED_ROLES = [...SALES_HANDOFF_ROLES, ...MARKETING_ROLES];

type Params = { params: Promise<{ id: string; noteId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, noteId } = await params;
  const { user, role, admin, deny } = await requireRole(ALLOWED_ROLES);
  if (deny) return deny;
  const denied = await assertOpportunityAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data: opp } = await admin.from('opportunities').select('need_id').eq('id', id).maybeSingle();
  if (!opp?.need_id) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

  const { data, error } = await admin.from('need_notes').delete()
    .eq('id', noteId).eq('need_id', opp.need_id).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'opportunity.note_deleted', resource: `need_notes:${noteId}` });
  return NextResponse.json({ ok: true });
}
