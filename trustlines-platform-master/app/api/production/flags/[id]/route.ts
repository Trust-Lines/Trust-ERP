import { NextRequest, NextResponse } from 'next/server';
import { requireProductionWrite } from '@/lib/production/guard';
import { logAudit } from '@/lib/audit/log';

type Params = { params: Promise<{ id: string }> };

/** Mark a To do / Follow Up flag done (or not done again). */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireProductionWrite();
  if (deny) return deny;
  const { id } = await params;
  const { completed } = await req.json().catch(() => ({})) as { completed?: boolean };
  const { data, error } = await admin.from('production_pf_flags')
    .update({ completed_at: completed ? new Date().toISOString() : null }).eq('id', id).select('id, completed_at').maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not update the flag' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
  await logAudit({ actorId: user.id, action: completed ? 'production.flag_done' : 'production.flag_reopened', resource: `production_pf_flag:${id}` });
  return NextResponse.json({ flag: data });
}

/** Remove a flag (it only marks work; no production data goes with it). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireProductionWrite();
  if (deny) return deny;
  const { id } = await params;
  const { data, error } = await admin.from('production_pf_flags').delete().eq('id', id).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not remove the flag' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
  await logAudit({ actorId: user.id, action: 'production.flag_removed', resource: `production_pf_flag:${id}` });
  return NextResponse.json({ ok: true });
}
