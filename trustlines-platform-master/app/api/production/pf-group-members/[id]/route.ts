import { NextRequest, NextResponse } from 'next/server';
import { requireProductionWrite } from '@/lib/production/guard';
import { logAudit } from '@/lib/audit/log';

type Params = { params: Promise<{ id: string }> };
type Member = { id: string; rank: number };

/** Tiers are numbered 1, 2, 3… with no gaps after every change (Trust System rule). */
async function renumber(admin: { from: (t: string) => any }, groupId: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data } = await admin.from('production_pf_group_members').select('id, rank').eq('group_id', groupId) as { data: Member[] | null };
  const tiers = [...new Set((data ?? []).map(m => m.rank))].sort((a, b) => a - b);
  const to = new Map(tiers.map((r, i) => [r, i + 1]));
  for (const m of data ?? []) {
    const next = to.get(m.rank)!;
    if (next !== m.rank) await admin.from('production_pf_group_members').update({ rank: next }).eq('id', m.id);
  }
}

/**
 * Move a project + type a tier up or down: { direction: 'up' | 'down' }.
 * Up joins the tier above (not possible from the top); down joins the tier below, or starts a new
 * one when it is already the last.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireProductionWrite();
  if (deny) return deny;
  const { id } = await params;
  const { direction } = await req.json().catch(() => ({})) as { direction?: string };
  if (direction !== 'up' && direction !== 'down') return NextResponse.json({ error: 'direction must be up or down' }, { status: 400 });

  const { data: member } = await admin.from('production_pf_group_members').select('id, group_id, rank').eq('id', id).maybeSingle() as {
    data: { id: string; group_id: string; rank: number } | null;
  };
  if (!member) return NextResponse.json({ error: 'Group member not found' }, { status: 404 });
  const { data: all } = await admin.from('production_pf_group_members').select('id, rank').eq('group_id', member.group_id) as { data: Member[] | null };
  const tiers = [...new Set((all ?? []).map(m => m.rank))].sort((a, b) => a - b);
  const at = tiers.indexOf(member.rank);
  let rank: number;
  if (direction === 'up') {
    if (at <= 0) return NextResponse.json({ error: 'Already in the top tier' }, { status: 400 });
    rank = tiers[at - 1];
  } else {
    rank = at < tiers.length - 1 ? tiers[at + 1] : tiers[tiers.length - 1] + 1;
  }
  const { error } = await admin.from('production_pf_group_members').update({ rank }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not move it' }, { status: 500 });
  await renumber(admin, member.group_id);
  await logAudit({ actorId: user.id, action: 'production.pf_group_member_moved', resource: `production_pf_group_member:${id}`, newValue: { direction } });
  return NextResponse.json({ ok: true });
}

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
  else await renumber(admin, data.group_id);
  await logAudit({ actorId: user.id, action: 'production.pf_group_member_removed', resource: `production_pf_group_member:${id}` });
  return NextResponse.json({ ok: true });
}
