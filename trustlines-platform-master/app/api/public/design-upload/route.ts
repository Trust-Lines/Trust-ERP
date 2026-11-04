import { NextRequest, NextResponse } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox/client';
import { verifyUploadTicket } from '@/lib/design/uploadTicket';
import { dropboxError } from '@/lib/design/dropboxDirect';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Chunked upload for Design files over Dropbox's 150 MB one-shot link limit (lib/client/
// designUpload). Each request carries one chunk (≤ 4 MB, under the serverless body cap) as the raw
// body, plus:
//   x-ticket   the signed target from the upload-link step (lib/design/uploadTicket) — the only
//              thing that decides where the file goes; that step already checked who may upload
//   x-session  Dropbox upload session id (empty on the first chunk)
//   x-offset   bytes already sent
//   x-last     "1" on the final chunk → the file is committed at the ticket's path
// → { sessionId } while going, { path } when done. Under /api/public so the no-login video upload
// page can use it too; without a valid ticket nothing is written.
export async function POST(req: NextRequest) {
  const path = verifyUploadTicket(req.headers.get('x-ticket'));
  if (!path) return NextResponse.json({ error: 'This upload has expired — start it again' }, { status: 403 });
  const sessionId = req.headers.get('x-session') || '';
  const offset = Number(req.headers.get('x-offset') ?? 0);
  const last = req.headers.get('x-last') === '1';
  if (!Number.isFinite(offset) || offset < 0) return NextResponse.json({ error: 'Bad offset' }, { status: 400 });

  const contents = Buffer.from(await req.arrayBuffer());
  if (contents.length > 4.5 * 1024 * 1024) return NextResponse.json({ error: 'Chunk too large' }, { status: 413 });

  const dbx = getDropboxClient();
  try {
    let id = sessionId;
    if (!id) {
      // First chunk opens the session; a file that fits in one chunk is committed straight away.
      const start = await dbx.filesUploadSessionStart({ contents, close: false });
      id = start.result.session_id;
      if (!last) return NextResponse.json({ sessionId: id });
      const done = await dbx.filesUploadSessionFinish({
        cursor: { session_id: id, offset: contents.length },
        commit: { path, mode: { '.tag': 'add' }, autorename: false },
        contents: Buffer.alloc(0),
      });
      return NextResponse.json({ path: done.result.path_display ?? path });
    }
    if (!last) {
      await dbx.filesUploadSessionAppendV2({ cursor: { session_id: id, offset }, contents, close: false });
      return NextResponse.json({ sessionId: id });
    }
    const done = await dbx.filesUploadSessionFinish({
      cursor: { session_id: id, offset },
      commit: { path, mode: { '.tag': 'add' }, autorename: false },
      contents,
    });
    return NextResponse.json({ path: done.result.path_display ?? path });
  } catch (e) {
    console.error('[design-upload]', dropboxError(e));
    return NextResponse.json({ error: `Dropbox: ${dropboxError(e)}` }, { status: 502 });
  }
}
