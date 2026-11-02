import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDropboxClient } from '@/lib/dropbox/client';

// A person's profile photo, for signed-in users: redirects to a short-lived Dropbox link (they
// expire after 4 h, so the link is never stored). 404 when the person has no photo.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const { userId } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data } = await admin.from('profiles').select('avatar_path').eq('id', userId).maybeSingle();
  const path = (data as { avatar_path?: string | null } | null)?.avatar_path;
  if (!path) return new NextResponse(null, { status: 404 });
  try {
    const { result } = await getDropboxClient().filesGetTemporaryLink({ path });
    // Callers add ?v=<updated time>, so caching for an hour never shows a stale photo.
    return NextResponse.redirect(result.link, { status: 302, headers: { 'Cache-Control': 'private, max-age=3600' } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
