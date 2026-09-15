import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_MANAGE_ROLES } from '@/lib/marketing/roles';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(MARKETING_MANAGE_ROLES, 'Not authorized');
  if (deny) return deny;

  const { data: row } = await admin.from('prospects').select('id, display_name, deleted_at').eq('id', id).maybeSingle();
  const prospect = row as { id: string; display_name: string; deleted_at: string | null } | null;
  if (!prospect || !prospect.deleted_at) {
    return NextResponse.json({ error: 'Prospect must be in the trash first' }, { status: 400 });
  }

  // Child rows (contacts, locations, needs, potentials, opportunities, files, campaign interactions)
  // all carry ON DELETE CASCADE FKs to prospects(id) — deleting the prospect row cascades them.
  const { error } = await admin.from('prospects').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: user.id, action: 'prospect.permanently_deleted', resource: 'prospect',
    newValue: { deletedProspectId: id, display_name: prospect.display_name },
  });

  return NextResponse.json({ ok: true });
}
