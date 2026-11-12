import { NextRequest, NextResponse } from 'next/server';
import { requireProductionWrite } from '@/lib/production/guard';
import { logAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

/**
 * "Add to Group…" in the project menu (Trust System AddToGroupModal), migration 152 tables.
 *   { projectId, type }                    → a new group (next number), the type at rank 1
 *   { projectId, type, groupId, rank }     → the type joins that group at that rank
 * A project + type is in a group at most once.
 */
export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireProductionWrite();
  if (deny) return deny;

  const body = await req.json().catch(() => ({})) as { projectId?: string; type?: string; groupId?: string | null; rank?: number };
  const projectId = String(body.projectId ?? '').trim();
  const type = String(body.type ?? '').trim();
  if (!projectId || !type) return NextResponse.json({ error: 'projectId and type are required' }, { status: 400 });

  const { data: project } = await admin.from('projects').select('id').eq('id', projectId).is('deleted_at', null).maybeSingle();
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  let groupId = body.groupId ? String(body.groupId) : null;
  let rank = 1;
  if (groupId) {
    const { data: group, error: gErr } = await admin.from('production_pf_groups').select('id').eq('id', groupId).maybeSingle();
    if (gErr) return NextResponse.json({ error: 'PF groups are not set up yet (migration 152)' }, { status: 503 });
    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    const { data: dup } = await admin.from('production_pf_group_members').select('id')
      .eq('group_id', groupId).eq('project_id', projectId).eq('type', type).maybeSingle();
    if (dup) return NextResponse.json({ error: 'This type is already in that group.' }, { status: 409 });
    rank = Math.max(1, Math.floor(Number(body.rank) || 1));
  } else {
    const { data: last, error: lErr } = await admin.from('production_pf_groups').select('number').order('number', { ascending: false }).limit(1);
    if (lErr) return NextResponse.json({ error: 'PF groups are not set up yet (migration 152)' }, { status: 503 });
    const number = ((last?.[0] as { number?: number } | undefined)?.number ?? 0) + 1;
    const { data: created, error } = await admin.from('production_pf_groups').insert({ number }).select('id, number').single();
    if (error) return NextResponse.json({ error: 'Could not create the group' }, { status: 500 });
    groupId = created.id;
  }

  const { data: member, error } = await admin.from('production_pf_group_members')
    .insert({ group_id: groupId, project_id: projectId, type, rank }).select('id, group_id, rank').single();
  if (error) return NextResponse.json({ error: 'Could not add it to the group' }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'production.pf_group_member_added', projectId, resource: `production_pf_group:${groupId}`, newValue: { type, rank } });
  return NextResponse.json({ member });
}
