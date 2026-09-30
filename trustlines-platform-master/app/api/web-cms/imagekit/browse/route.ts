import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { listFolder } from '@/lib/web-cms/imagekit';

export const dynamic = 'force-dynamic';

// Read-only: lists images/folders so an editor can pick an existing image (e.g. from the old
// site). Nothing here can upload, move or delete.
export async function GET(req: NextRequest) {
  const { deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const path = req.nextUrl.searchParams.get('path') || '/';
  if (path.includes('..')) return NextResponse.json({ error: 'Bad path' }, { status: 400 });
  try {
    return NextResponse.json({ path, entries: await listFolder(path) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'ImageKit error' }, { status: 502 });
  }
}
