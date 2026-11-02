import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { canEditEntry, requireDesignPage } from '@/lib/design/access';
import { fileIn } from '@/lib/design/dropboxDirect';
import { getDropboxClient } from '@/lib/dropbox/client';
import { PRODUCT_IMAGES_ROOT, PRODUCT_VIDEOS_ROOT, stickerFieldsFrom } from '@/lib/design/productVideos';

type Params = { params: Promise<{ id: string }> };
const COLS = 'id, slug, product_code, title, category, specs, collection, color_name, color_hex, image_path, dropbox_path, file_name, size_bytes, created_by, created_at, updated_at';
const KEY = 'page.design_videos';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function load(admin: any, id: string) {
  const { data } = await admin.from('product_videos').select(COLS).eq('id', id).is('deleted_at', null).maybeSingle();
  return data as { id: string; created_by: string | null; product_code: string; image_path: string | null } | null;
}

// The product drawing's bytes — the sticker PDF is built in the browser.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { admin, deny } = await requireDesignPage(KEY);
  if (deny) return deny;
  const video = await load(admin, id);
  if (!video?.image_path) return NextResponse.json({ error: 'No drawing' }, { status: 404 });
  try {
    const res = await getDropboxClient().filesDownload({ path: video.image_path });
    const blob = (res.result as unknown as { fileBinary: Buffer }).fileBinary;
    const type = /\.png$/i.test(video.image_path) ? 'image/png' : 'image/jpeg';
    return new NextResponse(new Uint8Array(blob), { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=60' } });
  } catch {
    return NextResponse.json({ error: 'The drawing is not available in Dropbox' }, { status: 502 });
  }
}

// Sticker fields, plus `path` (a newly uploaded video) / `imagePath` (a new drawing). The link and
// QR code never change.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, isManager, deny } = await requireDesignPage(KEY);
  if (deny) return deny;
  const video = await load(admin, id);
  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canEditEntry(video, user.id, isManager)) return NextResponse.json({ error: 'Only the uploader or a manager can edit this' }, { status: 403 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), ...stickerFieldsFrom(body) };
  if ('productCode' in body) {
    const c = String(body.productCode ?? '').trim();
    if (!c) return NextResponse.json({ error: 'Product code required' }, { status: 400 });
    patch.product_code = c.slice(0, 120);
  }
  if (body.path) {
    const file = await fileIn(PRODUCT_VIDEOS_ROOT, String(body.path));
    if (!file) return NextResponse.json({ error: 'The uploaded video was not found in Dropbox' }, { status: 400 });
    Object.assign(patch, { dropbox_path: file.path, file_name: file.name, size_bytes: file.size });
  }
  if ('imagePath' in body) {
    if (!body.imagePath) patch.image_path = null;
    else {
      const img = await fileIn(PRODUCT_IMAGES_ROOT, String(body.imagePath));
      if (!img) return NextResponse.json({ error: 'The uploaded drawing was not found in Dropbox' }, { status: 400 });
      patch.image_path = img.path;
    }
  }
  const { data, error } = await admin.from('product_videos').update(patch).eq('id', id).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (body.path) await logAudit({ actorId: user.id, action: 'product_video.replaced', resource: `product_video:${id}`, newValue: { file: patch.file_name } });
  return NextResponse.json({ video: data });
}

// Soft delete: the public link stops working; the Dropbox files stay.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, isManager, deny } = await requireDesignPage(KEY);
  if (deny) return deny;
  const video = await load(admin, id);
  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canEditEntry(video, user.id, isManager)) return NextResponse.json({ error: 'Only the uploader or a manager can remove this' }, { status: 403 });
  const { error } = await admin.from('product_videos').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'product_video.removed', resource: `product_video:${id}`, oldValue: { productCode: video.product_code } });
  return NextResponse.json({ ok: true });
}
