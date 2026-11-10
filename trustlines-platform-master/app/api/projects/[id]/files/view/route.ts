import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertProjectAccess } from '@/lib/permissions/projectAccess';
import { cachedTemporaryLink } from '@/lib/dropbox/client';
import { resolveInside } from '@/lib/sales/designPaths';
import { dropboxErrorInfo, dropboxErrorMessage, withDropboxRetry } from '@/lib/dropbox/errors';
import { inlineMime } from '@/lib/files/viewKind';

// The Files tab viewer: streams one file of the project's Dropbox folder *inline* (PDF, image,
// video, audio, text) so the browser shows it instead of downloading it. Range requests are passed
// through, so big PDFs start rendering before they finish loading. Images, video and audio are
// redirected to Dropbox's CDN instead (faster; those elements ignore the download header).
export const maxDuration = 300;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const denied = await assertProjectAccess(id, user.id, (prof as { role?: string } | null)?.role ?? null);
  if (denied) return denied;
  const { data: proj } = await admin.from('projects').select('dropbox_root_path').eq('id', id).single();
  const root = (proj as { dropbox_root_path?: string | null } | null)?.dropbox_root_path?.replace(/\/+$/, '');
  if (!root) return NextResponse.json({ error: 'This project has no Dropbox folder yet' }, { status: 409 });

  const abs = resolveInside(root, req.nextUrl.searchParams.get('path'));
  if (!abs || abs === root) return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
  const name = abs.split('/').pop()!;
  const mime = inlineMime(name);
  if (!mime) return NextResponse.json({ error: 'This file type can’t be shown in the browser' }, { status: 415 });

  try {
    const link = await withDropboxRetry(() => cachedTemporaryLink(abs));
    // <img> / <video> / <audio> ignore Dropbox's 'attachment' header, so they load straight from
    // Dropbox's CDN — no detour through this server. PDFs (iframe) and text still stream below.
    if (/^(image|video|audio)\//.test(mime) && mime !== 'image/svg+xml') {
      return NextResponse.redirect(link, { status: 302, headers: { 'Cache-Control': 'private, max-age=600' } });
    }
    const range = req.headers.get('range');
    const upstream = await fetch(link, range ? { headers: { Range: range } } : undefined);
    if (!upstream.ok && upstream.status !== 206) return NextResponse.json({ error: `Dropbox: HTTP ${upstream.status}` }, { status: 502 });
    const headers = new Headers({
      'Content-Type': mime,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
    });
    for (const h of ['content-length', 'content-range']) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    // SVG can carry script: sandbox it when opened on its own.
    if (mime === 'image/svg+xml') headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch (e) {
    const info = dropboxErrorInfo(e);
    if (info.notFound) return NextResponse.json({ error: 'This file is not in Dropbox' }, { status: 404 });
    return NextResponse.json({ error: dropboxErrorMessage(e) }, { status: 502 });
  }
}
