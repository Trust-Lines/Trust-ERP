import { NextResponse } from 'next/server';
import { failed, requireInstallations } from '@/lib/installations/access';
import { cleanPatch } from '@/lib/installations/validate';

const COLS = '*';  // every column (team_id arrives with migration 143)
const UUID = /^[0-9a-f-]{36}$/i;

/** Change cells of one register row. Body: { field: value, … }. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, canEdit, deny } = await requireInstallations();
  if (deny) return deny;
  if (!canEdit) return NextResponse.json({ error: 'You can’t edit the installation plan' }, { status: 403 });
  if (!UUID.test(id)) return NextResponse.json({ error: 'Unknown row' }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Nothing to save' }, { status: 400 });
  const clean = cleanPatch(body);
  if ('error' in clean) return NextResponse.json({ error: clean.error }, { status: 400 });
  if (!Object.keys(clean.patch).length) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 });

  const { data, error } = await admin.from('installations')
    .update({ ...clean.patch, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq('id', id).select(COLS).maybeSingle();
  if (error) return failed(error);
  if (!data) return NextResponse.json({ error: 'Row not found' }, { status: 404 });
  return NextResponse.json({ row: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { admin, canEdit, deny } = await requireInstallations();
  if (deny) return deny;
  if (!canEdit) return NextResponse.json({ error: 'You can’t edit the installation plan' }, { status: 403 });
  if (!UUID.test(id)) return NextResponse.json({ error: 'Unknown row' }, { status: 400 });
  const { error } = await admin.from('installations').delete().eq('id', id);
  if (error) return failed(error);
  return NextResponse.json({ ok: true });
}
