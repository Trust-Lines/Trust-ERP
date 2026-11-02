import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { requireDesignPage, tableMissing } from '@/lib/design/access';
import { dropboxError, fileIn, uploadLinkIn } from '@/lib/design/dropboxDirect';
import { PRODUCT_VIDEOS_NOT_READY, PRODUCT_VIDEOS_ROOT, newVideoSlug } from '@/lib/design/productVideos';
import { appBaseUrl } from '@/lib/env/appUrl';
import { safeSegment } from '@/lib/sales/designPaths';

const COLS = 'id, slug, product_code, title, file_name, size_bytes, created_by, created_at, updated_at';
const KEY = 'page.design_videos';
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

// Product installation videos — the QR code on a packaging sticker opens /install/<slug>.
export async function GET() {
  const { user, admin, isManager, deny } = await requireDesignPage(KEY);
  if (deny) return deny;
  const { data, error } = await admin.from('product_videos').select(COLS).is('deleted_at', null).order('product_code').limit(2000);
  if (error) {
    return tableMissing(error)
      ? NextResponse.json({ notReady: PRODUCT_VIDEOS_NOT_READY, videos: [], baseUrl: appBaseUrl() })
      : NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ me: user.id, isManager, videos: data ?? [], baseUrl: appBaseUrl() });
}

// { action: 'upload-link', productCode, fileName } → one-shot Dropbox link (videos go straight to Dropbox)
// { action: 'create', productCode, title, path }   → the product + its public link
export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireDesignPage(KEY);
  if (deny) return deny;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const productCode = String(body.productCode ?? '').trim().slice(0, 120);

  if (body.action === 'upload-link') {
    const fileName = String(body.fileName ?? '');
    if (!VIDEO_EXT.test(fileName)) return NextResponse.json({ error: 'Choose an MP4, MOV or WEBM video' }, { status: 400 });
    try {
      const link = await uploadLinkIn(PRODUCT_VIDEOS_ROOT, `${safeSegment(productCode, 'Product')} - ${fileName}`);
      return link ? NextResponse.json({ link }) : NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
    } catch (e) { return NextResponse.json({ error: `Dropbox: ${dropboxError(e)}` }, { status: 502 }); }
  }

  if (body.action === 'create') {
    if (!productCode) return NextResponse.json({ error: 'Product code required' }, { status: 400 });
    const file = await fileIn(PRODUCT_VIDEOS_ROOT, String(body.path ?? ''));
    if (!file) return NextResponse.json({ error: 'The uploaded video was not found in Dropbox' }, { status: 400 });
    const { data, error } = await admin.from('product_videos').insert({
      slug: newVideoSlug(), product_code: productCode,
      title: String(body.title ?? '').trim().slice(0, 200) || null,
      dropbox_path: file.path, file_name: file.name, size_bytes: file.size, created_by: user.id,
    }).select(COLS).single();
    if (error) {
      const missing = tableMissing(error);
      return NextResponse.json({ error: missing ? PRODUCT_VIDEOS_NOT_READY : error.message }, { status: missing ? 409 : 500 });
    }
    await logAudit({ actorId: user.id, action: 'product_video.created', resource: `product_video:${data.id}`, newValue: { productCode } });
    return NextResponse.json({ video: data }, { status: 201 });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
