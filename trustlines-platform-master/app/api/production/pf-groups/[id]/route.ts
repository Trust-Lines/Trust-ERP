import { NextRequest, NextResponse } from 'next/server';
import { requireProductionWrite } from '@/lib/production/guard';
import { logAudit } from '@/lib/audit/log';

type Params = { params: Promise<{ id: string }> };

/** Delete a whole PF group. Only the grouping goes; projects and rows are not touched. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireProductionWrite();
  if (deny) return deny;
  const { id } = await params;
  const { error: mErr } = await admin.from('production_pf_group_members').delete().eq('group_id', id);
  if (mErr) return NextResponse.json({ error: 'Could not delete the group' }, { status: 500 });
  const { data, error } = await admin.from('production_pf_groups').delete().eq('id', id).select('id, number').maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not delete the group' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  await logAudit({ actorId: user.id, action: 'production.pf_group_deleted', resource: `production_pf_group:${id}`, oldValue: { number: data.number } });
  return NextResponse.json({ ok: true });
}
