import { NextResponse } from 'next/server';
import { failed, requireInstallations } from '@/lib/installations/access';
import { cleanTeam } from '@/lib/installations/teams';

// T-Lines PM → Installation → Teams (public.install_teams, migration 143).
export async function GET() {
  const { admin, deny } = await requireInstallations();
  if (deny) return deny;
  const { data, error } = await admin.from('install_teams').select('*').order('sort_order', { ascending: true }).order('name');
  if (error) return failed(error);
  return NextResponse.json({ teams: data ?? [] });
}

export async function POST(req: Request) {
  const { user, admin, canEdit, deny } = await requireInstallations();
  if (deny) return deny;
  if (!canEdit) return NextResponse.json({ error: 'You can’t edit the installation teams' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const clean = cleanTeam(body ?? {}, false);
  if ('error' in clean) return NextResponse.json({ error: clean.error }, { status: 400 });

  const { data: last } = await admin.from('install_teams').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await admin.from('install_teams')
    .insert({ ...clean.team, sort_order: ((last as { sort_order?: number } | null)?.sort_order ?? 0) + 1, created_by: user.id })
    .select('*').single();
  if (error?.code === '23505') return NextResponse.json({ error: 'There is already a team with that name' }, { status: 409 });
  if (error) return failed(error);
  return NextResponse.json({ team: data });
}
