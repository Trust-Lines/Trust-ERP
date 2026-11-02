import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { dropboxError, fileIn, uploadLinkIn } from '@/lib/design/dropboxDirect';
import { PRODUCT_VIDEOS_ROOT, installPath, isUploadToken, newVideoSlug } from '@/lib/design/productVideos';
import { appBaseUrl } from '@/lib/env/appUrl';
import { safeSegment } from '@/lib/sales/designPaths';

export const dynamic = 'force-dynamic';
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

// Public (no login — middleware lets /api/public through), gated by an upload link's token
// (product_video_upload_links, migration 139; revoked links stop working):
//   { token, action: 'upload-link', productCode, fileName } → one-shot Dropbox link for the video
//   { token, action: 'save', productCode, title, path }      → the product's video + its QR link.
// A product code that already exists gets the new video — its QR code stays the same.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const token = String(body.token ?? '');
  if (!isUploadToken(token)) return NextResponse.json({ error: 'This upload link is not valid' }, { status: 403 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: link } = await admin.from('product_video_upload_links').select('id').eq('token', token).is('revoked_at', null).maybeSingle();
  if (!link) return NextResponse.json({ error: 'This upload link is not valid any more' }, { status: 403 });

  const productCode = String(body.productCode ?? '').trim().slice(0, 120);
  if (!productCode) return NextResponse.json({ error: 'Enter the product code' }, { status: 400 });

  if (body.action === 'upload-link') {
    const fileName = String(body.fileName ?? '');
    if (!VIDEO_EXT.test(fileName)) return NextResponse.json({ error: 'Choose an MP4, MOV or WEBM video' }, { status: 400 });
    try {
      const url = await uploadLinkIn(PRODUCT_VIDEOS_ROOT, `${safeSegment(productCode, 'Product')} - ${fileName}`);
      return url ? NextResponse.json({ link: url }) : NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
    } catch (e) { return NextResponse.json({ error: `Dropbox: ${dropboxError(e)}` }, { status: 502 }); }
  }

  if (body.action === 'save') {
    const file = await fileIn(PRODUCT_VIDEOS_ROOT, String(body.path ?? ''));
    if (!file) return NextResponse.json({ error: 'The uploaded video was not found' }, { status: 400 });
    const video = { dropbox_path: file.path, file_name: file.name, size_bytes: file.size, uploaded_via: link.id, updated_at: new Date().toISOString() };
    const title = String(body.title ?? '').trim().slice(0, 200) || null;

    const { data: existing } = await admin.from('product_videos').select('id, slug, title')
      .ilike('product_code', productCode.replace(/[%_\\]/g, m => `\\${m}`)).is('deleted_at', null).limit(1).maybeSingle();
    let slug: string;
    if (existing) {
      const { error } = await admin.from('product_videos').update({ ...video, ...(title && !existing.title ? { title } : {}) }).eq('id', existing.id);
      if (error) return NextResponse.json({ error: 'Could not save the video' }, { status: 500 });
      slug = existing.slug;
    } else {
      slug = newVideoSlug();
      const { error } = await admin.from('product_videos').insert({ slug, product_code: productCode, title, ...video });
      if (error) return NextResponse.json({ error: 'Could not save the video' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, replaced: !!existing, productCode, link: `${appBaseUrl()}${installPath(slug)}` });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
