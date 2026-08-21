import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data: prospect } = await admin.from('prospects').select('id, display_name').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!prospect) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const now = new Date().toISOString();
  const { data: needs } = await admin.from('prospect_needs').select('id').eq('prospect_id', id).is('deleted_at', null);
  const needIds = ((needs ?? []) as { id: string }[]).map(n => n.id);

  await admin.from('prospects').update({ deleted_at: now }).eq('id', id);
  await admin.from('prospect_needs').update({ deleted_at: now }).eq('prospect_id', id).is('deleted_at', null);
  await admin.from('prospect_potentials').update({ deleted_at: now }).eq('prospect_id', id).is('deleted_at', null);
  await admin.from('opportunities').update({ deleted_at: now }).eq('prospect_id', id).is('deleted_at', null);

  await logAudit({
    actorId: user.id, action: 'prospect.trashed', resource: `prospect:${id}`,
    newValue: { display_name: prospect.display_name, needs_cascaded: needIds.length },
  });

  return NextResponse.json({ ok: true });
}
