import { NextRequest, NextResponse } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox/client';
import { createClient, requireUser } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const supabase = await createClient();

  const { path } = await request.json() as { path: string };
  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 });

  try {
    const dbx = getDropboxClient();
    await dbx.filesCreateFolderV2({ path, autorename: false });
    return NextResponse.json({ success: true, path });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('path/conflict')) {
      return NextResponse.json({ success: true, path, alreadyExists: true });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
