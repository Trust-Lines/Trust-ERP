import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_MANAGE_ROLES } from '@/lib/marketing/roles';

type Params = { params: Promise<{ id: string; needId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id, needId } = await params;
  const { user, admin, deny } = await requireRole(MARKETING_MANAGE_ROLES, 'Not authorized');
  if (deny) return deny;

  const { data: row } = await admin.from('prospect_needs').select('id, title, deleted_at').eq('id', needId).eq('prospect_id', id).maybeSingle();
  const need = row as { id: string; title: string; deleted_at: string | null } | null;
  if (!need || !need.deleted_at) {
    return NextResponse.json({ error: 'Need must be in the trash first' }, { status: 400 });
  }

  // prospect_potentials/opportunities/prospect_need_documents all carry FKs to
  // prospect_needs(id) — deleting the Need row cascades them.
  const { error } = await admin.from('prospect_needs').delete().eq('id', needId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: user.id, action: 'need.permanently_deleted', resource: 'prospect_need',
    newValue: { deletedNeedId: needId, prospect_id: id, title: need.title },
  });

  return NextResponse.json({ ok: true });
}
