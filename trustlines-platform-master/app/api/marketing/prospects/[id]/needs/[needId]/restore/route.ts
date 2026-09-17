import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';

type Params = { params: Promise<{ id: string; needId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id, needId } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data: need } = await admin.from('prospect_needs').select('id, title, deleted_at').eq('id', needId).eq('prospect_id', id).maybeSingle();
  const row = need as { id: string; title: string; deleted_at: string | null } | null;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!row.deleted_at) return NextResponse.json({ error: 'Need is not in the trash' }, { status: 400 });

  const trashedAt = row.deleted_at;

  await admin.from('prospect_needs').update({ deleted_at: null }).eq('id', needId);
  const [{ data: potentials }, { data: opportunities }] = await Promise.all([
    admin.from('prospect_potentials').update({ deleted_at: null }).eq('need_id', needId).eq('deleted_at', trashedAt).select('id'),
    admin.from('opportunities').update({ deleted_at: null }).eq('need_id', needId).eq('deleted_at', trashedAt).select('id'),
  ]);

  await logAudit({
    actorId: user.id, action: 'need.restored', resource: `prospect_need:${needId}`,
    newValue: {
      prospect_id: id, title: row.title,
      potentials_restored: ((potentials ?? []) as { id: string }[]).length,
      opportunities_restored: ((opportunities ?? []) as { id: string }[]).length,
    },
  });

  return NextResponse.json({ ok: true });
}
