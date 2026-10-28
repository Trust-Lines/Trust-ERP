import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { canEditEntry, requireDesignPage } from '@/lib/design/access';
import { dropboxError, temporaryLink } from '@/lib/design/dropboxDirect';
import { ASSET_KINDS, parseTags } from '@/lib/design/libraryPaths';

type Params = { params: Promise<{ id: string }> };
const COLS = 'id, kind, title, description, tags, dropbox_path, file_name, size_bytes, created_by, created_at, updated_at';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function load(admin: any, id: string) {
  const { data } = await admin.from('design_assets').select(COLS).eq('id', id).is('deleted_at', null).maybeSingle();
  return data as { id: string; created_by: string | null; dropbox_path: string; title: string } | null;
}

// { action: 'open' } → temporary download link
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { admin, deny } = await requireDesignPage('page.design_assets');
  if (deny) return deny;
  const asset = await load(admin, id);
  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try { return NextResponse.json({ link: await temporaryLink(asset.dropbox_path) }); }
  catch (e) { return NextResponse.json({ error: `Dropbox: ${dropboxError(e)}` }, { status: 502 }); }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, isManager, deny } = await requireDesignPage('page.design_assets');
  if (deny) return deny;
  const asset = await load(admin, id);
  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canEditEntry(asset, user.id, isManager)) return NextResponse.json({ error: 'Only the uploader or a manager can edit this' }, { status: 403 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('title' in body) {
    const t = String(body.title ?? '').trim();
    if (!t) return NextResponse.json({ error: 'Title required' }, { status: 400 });
    patch.title = t.slice(0, 200);
  }
  if ('description' in body) patch.description = String(body.description ?? '').trim().slice(0, 2000) || null;
  if ('tags' in body) patch.tags = parseTags(body.tags);
  if ('kind' in body && ASSET_KINDS.some(k => k.value === body.kind)) patch.kind = body.kind;
  const { data, error } = await admin.from('design_assets').update(patch).eq('id', id).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asset: data });
}

// Soft delete: the entry leaves the library; the Dropbox file stays where it is.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, isManager, deny } = await requireDesignPage('page.design_assets');
  if (deny) return deny;
  const asset = await load(admin, id);
  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canEditEntry(asset, user.id, isManager)) return NextResponse.json({ error: 'Only the uploader or a manager can remove this' }, { status: 403 });
  const { error } = await admin.from('design_assets').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'design_asset.removed', resource: `design_asset:${id}`, oldValue: { title: asset.title } });
  return NextResponse.json({ ok: true });
}
