import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';

type Params = { params: Promise<{ id: string; needId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id, needId } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data: need } = await admin.from('prospect_needs').select('id, title').eq('id', needId).eq('prospect_id', id).is('deleted_at', null).maybeSingle();
  if (!need) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const now = new Date().toISOString();
  await admin.from('prospect_needs').update({ deleted_at: now }).eq('id', needId);
  await admin.from('prospect_potentials').update({ deleted_at: now }).eq('need_id', needId).is('deleted_at', null);
  await admin.from('opportunities').update({ deleted_at: now }).eq('need_id', needId).is('deleted_at', null);

  await logAudit({ actorId: user.id, action: 'need.trashed', resource: `prospect_need:${needId}`, newValue: { prospect_id: id, title: need.title } });

  return NextResponse.json({ ok: true });
}
