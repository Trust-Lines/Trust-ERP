import { NextRequest, NextResponse } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox/client';
import { itApi, ticketFor } from '@/lib/it/server';
import { isUuid } from '@/lib/it/validate';

// Download a ticket's file: a short-lived Dropbox link (never stored), for its sender and IT.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { ctx, deny } = await itApi('request');
  if (deny) return deny;
  const { id, fileId } = await params;
  if (!isUuid(id) || !isUuid(fileId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const ticket = await ticketFor(ctx, id);
  const file = ticket?.files?.find(f => f.id === fileId);
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const { result } = await getDropboxClient().filesGetTemporaryLink({ path: file.path });
    return NextResponse.redirect(result.link, { status: 302, headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'The file could not be found in Dropbox' }, { status: 404 });
  }
}
