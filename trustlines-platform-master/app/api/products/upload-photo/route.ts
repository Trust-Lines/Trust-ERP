import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { getDropboxClient } from '@/lib/dropbox/client';

const PHOTOS_FOLDER = '/D-Projects/T LINES/_Product Photos';

export async function POST(req: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  const body = await req.json() as { base64: string; filename: string };
  if (!body.base64 || !body.filename) {
    return NextResponse.json({ error: 'base64 and filename required' }, { status: 400 });
  }

  const b64 = body.base64.includes(',') ? body.base64.split(',')[1] : body.base64;
  const buffer = Buffer.from(b64, 'base64');

  const ts   = Date.now();
  const safe = body.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${PHOTOS_FOLDER}/${ts}_${safe}`;

  try {
    const dbx = getDropboxClient();
    await dbx.filesCreateFolderV2({ path: PHOTOS_FOLDER, autorename: false }).catch(() => {});

    const res = await dbx.filesUpload({
      path,
      contents: buffer,
      mode: { '.tag': 'add' },
    });
    return NextResponse.json({ dropboxPath: res.result.path_lower ?? path });
  } catch (e) {
    console.error('[upload-photo]', e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
