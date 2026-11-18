import { NextRequest, NextResponse } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox/client';
import { logAudit } from '@/lib/audit/log';
import { itApi } from '@/lib/it/server';
import { isUuid } from '@/lib/it/validate';
import { IT_FILE_MAX_BYTES, IT_IMAGE_TYPES } from '@/lib/it/constants';

// An IT item's photo: GET redirects to a short-lived Dropbox link (IT management), POST stores a
// new one (edit.it) as a new file under /IT/Items/ — an older photo is kept, never overwritten.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, deny } = await itApi('manage');
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse(null, { status: 404 });
  const { data } = await ctx.admin.from('it_items').select('image_path').eq('id', id).maybeSingle();
  const path = (data as { image_path: string | null } | null)?.image_path;
  if (!path) return new NextResponse(null, { status: 404 });
  try {
    const { result } = await getDropboxClient().filesGetTemporaryLink({ path });
    // Callers add ?v=<updated time>, so an hour of caching never shows an old photo.
    return NextResponse.redirect(result.link, { status: 302, headers: { 'Cache-Control': 'private, max-age=3600' } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, deny } = await itApi('edit');
  if (deny) return deny;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data: item } = await ctx.admin.from('it_items').select('id').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Choose a photo' }, { status: 400 });
  const ext = IT_IMAGE_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: 'Use a JPG, PNG or WebP image' }, { status: 415 });
  if (file.size > IT_FILE_MAX_BYTES) return NextResponse.json({ error: 'The photo is too large (max 4 MB)' }, { status: 413 });

  let path: string;
  try {
    const res = await getDropboxClient().filesUpload({
      path: `/IT/Items/${id}.${ext}`,
      contents: Buffer.from(await file.arrayBuffer()),
      mode: { '.tag': 'add' },
      autorename: true,
    });
    path = res.result.path_lower ?? `/IT/Items/${id}.${ext}`;
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg = (e as any)?.error?.error_summary ?? (e instanceof Error ? e.message : 'Dropbox error');
    console.error('[it] item photo upload failed:', msg);
    return NextResponse.json({ error: `Dropbox: ${msg}` }, { status: 502 });
  }

  const at = new Date().toISOString();
  const { error } = await ctx.admin.from('it_items').update({ image_path: path, image_updated_at: at, updated_at: at }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ actorId: ctx.userId, action: 'it.item_photo', resource: `it_item:${id}`, newValue: { path } });
  return NextResponse.json({ url: `/api/it/items/${id}/image?v=${Date.parse(at)}` });
}
