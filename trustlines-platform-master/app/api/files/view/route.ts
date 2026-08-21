import { NextRequest, NextResponse } from 'next/server';
import { getDropboxTemporaryLink } from '@/lib/dropbox/upload';
import { createClient, requireUser } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('documentId');

  if (!documentId) {
    return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: doc, error } = await (supabase as any)
    .from('documents')
    .select('dropbox_path')
    .eq('id', documentId)
    .single();

  if (error || !doc) {
    return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
  }

  try {
    const link = await getDropboxTemporaryLink((doc as { dropbox_path: string }).dropbox_path);
    return NextResponse.json({ link });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Dropbox error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
