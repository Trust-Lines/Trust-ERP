import { NextRequest, NextResponse } from 'next/server';
import { requireProductionWrite } from '@/lib/production/guard';
import { logAudit } from '@/lib/audit/log';

type Params = { params: Promise<{ id: string }> };

/** Take a project + type out of its PF group; an emptied group goes too. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireProductionWrite();
  if (deny) return deny;
  const { id } = await params;
  const { data, error } = await admin.from('production_pf_group_members').delete().eq('id', id).select('id, group_id').maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not remove it from the group' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Group member not found' }, { status: 404 });
  const { count } = await admin.from('production_pf_group_members').select('id', { count: 'exact', head: true }).eq('group_id', data.group_id);
  if (!count) await admin.from('production_pf_groups').delete().eq('id', data.group_id);
  await logAudit({ actorId: user.id, action: 'production.pf_group_member_removed', resource: `production_pf_group_member:${id}` });
  return NextResponse.json({ ok: true });
}
