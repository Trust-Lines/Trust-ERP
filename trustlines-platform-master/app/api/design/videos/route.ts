import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { requireDesignPage, tableMissing } from '@/lib/design/access';
import { dropboxError, fileIn, uploadTargetIn } from '@/lib/design/dropboxDirect';
import {
  PRODUCT_IMAGES_ROOT, PRODUCT_VIDEOS_NOT_READY, PRODUCT_VIDEOS_ROOT, newVideoSlug, productUploadName, stickerFieldsFrom,
} from '@/lib/design/productVideos';
import { appBaseUrl, qrBaseUrl } from '@/lib/env/appUrl';
import { safeSegment } from '@/lib/sales/designPaths';

const COLS = 'id, slug, product_code, title, category, specs, collection, color_name, color_hex, image_path, dropbox_path, file_name, size_bytes, created_by, created_at, updated_at';
const KEY = 'page.design_videos';
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
const IMAGE_EXT = /\.(png|jpe?g)$/i;

// Products' packaging stickers + installation videos — the sticker's QR code opens /install/<slug>.
export async function GET() {
  const { user, admin, isManager, deny } = await requireDesignPage(KEY);
  if (deny) return deny;
  const { data, error } = await admin.from('product_videos').select(COLS).is('deleted_at', null).order('product_code').limit(2000);
  if (error) {
    return tableMissing(error)
      ? NextResponse.json({ notReady: PRODUCT_VIDEOS_NOT_READY, videos: [], baseUrl: appBaseUrl(), qrBaseUrl: qrBaseUrl() })
      : NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ me: user.id, isManager, videos: data ?? [], baseUrl: appBaseUrl(), qrBaseUrl: qrBaseUrl() });
}

// { action: 'upload-link', kind: 'video' | 'image', productCode, fileName } → one-shot Dropbox link
// { action: 'create', productCode, title, category, specs, collection, colorName, colorHex, path?, imagePath? }
export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireDesignPage(KEY);
  if (deny) return deny;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const productCode = String(body.productCode ?? '').trim().slice(0, 120);

  if (body.action === 'upload-link') {
    const fileName = String(body.fileName ?? '');
    const image = body.kind === 'image';
    if (!(image ? IMAGE_EXT : VIDEO_EXT).test(fileName)) {
      return NextResponse.json({ error: image ? 'Choose a PNG or JPG image' : 'Choose an MP4, MOV or WEBM video' }, { status: 400 });
    }
    try {
      const target = await uploadTargetIn(image ? PRODUCT_IMAGES_ROOT : PRODUCT_VIDEOS_ROOT, productUploadName(safeSegment(productCode, 'Product'), fileName));
      return target ? NextResponse.json(target) : NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
    } catch (e) { return NextResponse.json({ error: `Dropbox: ${dropboxError(e)}` }, { status: 502 }); }
  }

  if (body.action === 'create') {
    if (!productCode) return NextResponse.json({ error: 'Product code required' }, { status: 400 });
    const row: Record<string, unknown> = { slug: newVideoSlug(), product_code: productCode, created_by: user.id, ...stickerFieldsFrom(body) };
    if (body.path) {
      const file = await fileIn(PRODUCT_VIDEOS_ROOT, String(body.path));
      if (!file) return NextResponse.json({ error: 'The uploaded video was not found in Dropbox' }, { status: 400 });
      Object.assign(row, { dropbox_path: file.path, file_name: file.name, size_bytes: file.size });
    }
    if (body.imagePath) {
      const img = await fileIn(PRODUCT_IMAGES_ROOT, String(body.imagePath));
      if (!img) return NextResponse.json({ error: 'The uploaded drawing was not found in Dropbox' }, { status: 400 });
      row.image_path = img.path;
    }
    const { data, error } = await admin.from('product_videos').insert(row).select(COLS).single();
    if (error) {
      const missing = tableMissing(error);
      return NextResponse.json({ error: missing ? PRODUCT_VIDEOS_NOT_READY : error.message }, { status: missing ? 409 : 500 });
    }
    await logAudit({ actorId: user.id, action: 'product_video.created', resource: `product_video:${data.id}`, newValue: { productCode } });
    return NextResponse.json({ video: data }, { status: 201 });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
