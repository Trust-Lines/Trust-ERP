import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { temporaryLink } from '@/lib/design/dropboxDirect';
import { isVideoSlug } from '@/lib/design/productVideos';

export const dynamic = 'force-dynamic';

// Public (no login — middleware lets /api/public through): the installation video behind a
// packaging sticker's QR code. Redirects to a short-lived Dropbox link, so the player streams
// (and seeks) straight from Dropbox; only an existing, not-removed slug resolves.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isVideoSlug(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data } = await admin.from('product_videos').select('dropbox_path').eq('slug', slug).is('deleted_at', null).maybeSingle();
  if (!data?.dropbox_path) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const link = await temporaryLink(data.dropbox_path);
    return NextResponse.redirect(link, { status: 302, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'The video is not available right now' }, { status: 502 });
  }
}
