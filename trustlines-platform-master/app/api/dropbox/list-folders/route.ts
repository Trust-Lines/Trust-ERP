import { NextRequest, NextResponse } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox/client';
import { createClient, requireUser } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  await createClient();

  const path         = request.nextUrl.searchParams.get('path') ?? '';
  const includeFiles = request.nextUrl.searchParams.get('includeFiles') === 'true';

  try {
    const dbx    = getDropboxClient();
    const result = await dbx.filesListFolder({
      path:                          path === '/' || path === '' ? '' : path,
      recursive:                     false,
      include_non_downloadable_files: false,
      include_deleted:               false,
    });

    const entries = result.result.entries ?? [];

    const folders = entries
      .filter(e => e['.tag'] === 'folder')
      .map(e => ({ name: e.name, path: e.path_display ?? '' }))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!includeFiles) {
      return NextResponse.json({ folders });
    }

    const files = entries
      .filter(e => e['.tag'] === 'file')
      .map(e => ({
        name: e.name,
        path: e.path_display ?? '',
        size: (e as { size?: number }).size,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ folders, files });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not_found') || msg.includes('path/not_found')) {
      return NextResponse.json(includeFiles ? { folders: [], files: [] } : { folders: [] });
    }
    console.error('[dropbox/list-folders]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
