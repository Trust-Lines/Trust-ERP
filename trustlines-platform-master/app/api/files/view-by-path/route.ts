import { NextRequest, NextResponse } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox/client';
import { createClient, requireUser } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  const path      = request.nextUrl.searchParams.get('path') ?? '';
  const projectId = request.nextUrl.searchParams.get('projectId') ?? '';
  if (!path)      return NextResponse.json({ error: 'path required' }, { status: 400 });
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project } = await (supabase as any)
    .from('projects')
    .select('dropbox_root_path')
    .eq('id', projectId)
    .single();

  const root = (project as { dropbox_root_path: string | null } | null)?.dropbox_root_path;
  if (!root) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const norm = (s: string) => s.replace(/\\/g, '/').replace(/\/+$/, '');
  if (path.includes('..') || !norm(path).startsWith(norm(root))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const res = await getDropboxClient().filesGetTemporaryLink({ path });
    return NextResponse.json({ link: res.result.link });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
