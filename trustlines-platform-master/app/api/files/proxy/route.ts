import { NextRequest, NextResponse } from 'next/server';
import { getDropboxTemporaryLink } from '@/lib/dropbox/upload';
import { createClient, requireUser } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  const supabase = await createClient();
  const documentId = new URL(request.url).searchParams.get('documentId');
  if (!documentId) return new NextResponse('Missing documentId', { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: doc, error } = await (supabase as any)
    .from('documents')
    .select('dropbox_path, file_name')
    .eq('id', documentId)
    .single();

  if (error || !doc) return new NextResponse('Not found', { status: 404 });

  let upstream: Response;
  try {
    const link = await getDropboxTemporaryLink((doc as { dropbox_path: string }).dropbox_path);
    upstream = await fetch(link);
  } catch (err) {
    console.error('[files/proxy]', err instanceof Error ? err.message : err);
    return new NextResponse('Upstream error', { status: 502 });
  }
  if (!upstream.ok) return new NextResponse('Upstream error', { status: 502 });

  const safeName = ((doc as { file_name: string }).file_name ?? 'file').replace(/[\r\n"\\]/g, '');

  const headers = new Headers({
    'Content-Type': upstream.headers.get('Content-Type') ?? 'application/pdf',
    'Cache-Control': 'no-store',
    'Content-Disposition': `inline; filename="${safeName}"`,
  });

  return new NextResponse(upstream.body, { headers, status: 200 });
}
