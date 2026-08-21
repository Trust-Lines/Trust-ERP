import { NextRequest, NextResponse } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox/client';
import { createClient, requireUser } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const supabase = await createClient();

  const { targetPath } = await request.json() as { targetPath: string };
  if (!targetPath) return NextResponse.json({ error: 'targetPath required' }, { status: 400 });

  try {
    const dbx     = getDropboxClient();
    const ts      = Date.now();
    const filePath = `${targetPath}/connection-test-${ts}.txt`;
    const content = Buffer.from(
      `Trust-Lines Dropbox Wizard\nPath: ${targetPath}\nDate: ${new Date().toISOString()}\n`,
      'utf8',
    );

    const res = await dbx.filesUpload({
      path:     filePath,
      contents: content,
      mode:     { '.tag': 'add' },
    });

    return NextResponse.json({
      success:    true,
      targetPath,
      uploadedTo: res.result.path_display ?? filePath,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
