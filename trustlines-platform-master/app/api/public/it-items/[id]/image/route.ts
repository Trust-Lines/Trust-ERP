import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDropboxClient } from '@/lib/dropbox/client';
import { logAudit } from '@/lib/audit/log';
import { checkRateLimit, clientIp, hashIp } from '@/lib/security/rateLimit';
import { isUuid } from '@/lib/it/validate';
import { IT_FILE_MAX_BYTES, IT_IMAGE_TYPES } from '@/lib/it/constants';

/* eslint-disable @typescript-eslint/no-explicit-any */

// The QR label page's photo (/item/<id>, no account): GET redirects to a short-lived Dropbox link,
// POST adds a new photo as a new file under /IT/Items/ — an older photo is kept, never overwritten.
// Uploads are rate-limited per IP and audit-logged with a hashed IP.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse(null, { status: 404 });
  const admin = createAdminClient() as any;
  const { data } = await admin.from('it_items').select('image_path').eq('id', id).is('deleted_at', null).maybeSingle();
  const path = (data as { image_path: string | null } | null)?.image_path;
  if (!path) return new NextResponse(null, { status: 404 });
  try {
    const { result } = await getDropboxClient().filesGetTemporaryLink({ path });
    return NextResponse.redirect(result.link, { status: 302, headers: { 'Cache-Control': 'private, max-age=3600' } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const admin = createAdminClient() as any;
  const ipHash = await hashIp(clientIp(req.headers));
  const { allowed } = await checkRateLimit(admin, `it_item_public_photo:${ipHash}`, 10, 3600);
  if (!allowed) return NextResponse.json({ error: 'Too many uploads — try again later' }, { status: 429 });
  const { data: item } = await admin.from('it_items').select('id').eq('id', id).is('deleted_at', null).maybeSingle();
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
    const msg = (e as any)?.error?.error_summary ?? (e instanceof Error ? e.message : 'Dropbox error');
    console.error('[it] public item photo upload failed:', msg);
    return NextResponse.json({ error: 'The photo could not be stored — try again' }, { status: 502 });
  }

  const at = new Date().toISOString();
  const { error } = await admin.from('it_items').update({ image_path: path, image_updated_at: at, updated_at: at }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not save the photo' }, { status: 500 });
  await logAudit({ actorId: null, action: 'it.item_photo', resource: `it_item:${id}`, newValue: { path, via: 'qr_label', ip_hash: ipHash } });
  return NextResponse.json({ url: `/api/public/it-items/${id}/image?v=${Date.parse(at)}` });
}
