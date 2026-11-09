import { NextResponse } from 'next/server';
import { failed, requireInstallations } from '@/lib/installations/access';
import { cleanTeam } from '@/lib/installations/teams';
import { teamLabel } from '@/lib/installations/compute';

const UUID = /^[0-9a-f-]{36}$/i;

/** Edit a team. The rows that use it read it live, so they change with it. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { admin, canEdit, deny } = await requireInstallations();
  if (deny) return deny;
  if (!canEdit) return NextResponse.json({ error: 'You can’t edit the installation teams' }, { status: 403 });
  if (!UUID.test(id)) return NextResponse.json({ error: 'Unknown team' }, { status: 400 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const clean = cleanTeam(body ?? {}, true);
  if ('error' in clean) return NextResponse.json({ error: clean.error }, { status: 400 });

  const { data, error } = await admin.from('install_teams')
    .update({ ...clean.team, updated_at: new Date().toISOString() }).eq('id', id).select('*').maybeSingle();
  if (error?.code === '23505') return NextResponse.json({ error: 'There is already a team with that name' }, { status: 409 });
  if (error) return failed(error);
  if (!data) return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  // Keep the rows' text snapshot in step (exports, and the rows if the team is deleted later).
  await admin.from('installations').update({ team: teamLabel(data), team_size: (data.members?.length || data.size) ?? null }).eq('team_id', id);
  return NextResponse.json({ team: data });
}

/** Delete a team. Its rows keep the team as text (their snapshot) and can be given another team. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { admin, canEdit, deny } = await requireInstallations();
  if (deny) return deny;
  if (!canEdit) return NextResponse.json({ error: 'You can’t edit the installation teams' }, { status: 403 });
  if (!UUID.test(id)) return NextResponse.json({ error: 'Unknown team' }, { status: 400 });
  const { error } = await admin.from('install_teams').delete().eq('id', id);
  if (error) return failed(error);
  return NextResponse.json({ ok: true });
}
