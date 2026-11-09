import { NextResponse } from 'next/server';
import { failed, requireInstallations } from '@/lib/installations/access';
import { cleanPatch } from '@/lib/installations/validate';

const COLS = '*';  // every column (team_id arrives with migration 143)

// T-Lines PM → Installation: the register (public.installations, migration 142).
export async function GET() {
  const { admin, deny } = await requireInstallations();
  if (deny) return deny;
  const { data, error } = await admin.from('installations').select(COLS).order('sort_order', { ascending: true });
  if (error) return failed(error);
  return NextResponse.json({ rows: data ?? [] });
}

/** New register row. Body: any editable cells (blank row when empty). */
export async function POST(req: Request) {
  const { user, admin, canEdit, deny } = await requireInstallations();
  if (deny) return deny;
  if (!canEdit) return NextResponse.json({ error: 'You can’t edit the installation plan' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const clean = cleanPatch(body ?? {});
  if ('error' in clean) return NextResponse.json({ error: clean.error }, { status: 400 });

  const { data: last } = await admin.from('installations').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await admin.from('installations').insert({
    ...clean.patch, sort_order: ((last as { sort_order?: number } | null)?.sort_order ?? 0) + 1,
    created_by: user.id, updated_by: user.id,
  }).select(COLS).single();
  if (error) return failed(error);
  return NextResponse.json({ row: data });
}
