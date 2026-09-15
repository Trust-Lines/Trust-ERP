import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { assertProspectAccess } from '@/lib/marketing/prospectAccess';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const denied = await assertProspectAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { data: prospect } = await admin.from('prospects').select('id, display_name, deleted_at').eq('id', id).maybeSingle();
  const row = prospect as { id: string; display_name: string; deleted_at: string | null } | null;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!row.deleted_at) return NextResponse.json({ error: 'Prospect is not in the trash' }, { status: 400 });

  const trashedAt = row.deleted_at;

  await admin.from('prospects').update({ deleted_at: null }).eq('id', id);
  const [{ data: needs }, { data: potentials }, { data: opportunities }] = await Promise.all([
    admin.from('prospect_needs').update({ deleted_at: null }).eq('prospect_id', id).eq('deleted_at', trashedAt).select('id'),
    admin.from('prospect_potentials').update({ deleted_at: null }).eq('prospect_id', id).eq('deleted_at', trashedAt).select('id'),
    admin.from('opportunities').update({ deleted_at: null }).eq('prospect_id', id).eq('deleted_at', trashedAt).select('id'),
  ]);

  await logAudit({
    actorId: user.id, action: 'prospect.restored', resource: `prospect:${id}`,
    newValue: {
      display_name: row.display_name,
      needs_restored: ((needs ?? []) as { id: string }[]).length,
      potentials_restored: ((potentials ?? []) as { id: string }[]).length,
      opportunities_restored: ((opportunities ?? []) as { id: string }[]).length,
    },
  });

  return NextResponse.json({ ok: true });
}
