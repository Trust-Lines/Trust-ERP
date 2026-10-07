import { NextResponse } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox/client';
import { sanitizeFileName } from './prospectFiles';
import { isImageAttachment } from './surveyAttachments';

// Direct-to-Dropbox image upload for comment/Activity photos.
//
// Why: a serverless request body is capped at ~4.5 MB on every Vercel plan, so photos sent
// through our API had to be shrunk. Instead the browser asks the notes route for a one-shot
// Dropbox upload link (path fixed here, server-side — the caller only supplies a file name),
// PUTs the original file straight to Dropbox, then posts the note with the resulting path.
//
// Safety: no Dropbox credentials reach the browser; the link only writes ONE file to the
// record's own folder in `add` + autorename mode (never overwrites); before the note is saved
// the server re-checks the path is inside that folder and the file really exists.
// The classic multipart upload in the same routes stays as the fallback.

type NoteJson = Record<string, unknown>;
type DirectResult = { response: NextResponse } | { imagePath: string } | null;

export function isDirectUploadRequest(json: NoteJson): boolean {
  return json.action === 'upload-link' || typeof json.imagePath === 'string';
}

export async function createDirectUploadLink(folder: string, fileName: string): Promise<{ link: string }> {
  const path = `${folder}/${sanitizeFileName(fileName)}`;
  const res = await getDropboxClient().filesGetTemporaryUploadLink({
    commit_info: { path, mode: { '.tag': 'add' }, autorename: true },
    duration: 3600,
  });
  return { link: res.result.link };
}

export async function verifyDirectUpload(folder: string, imagePath: string): Promise<string | null> {
  const p = imagePath.trim();
  if (!p || p.includes('..') || !p.toLowerCase().startsWith(`${folder.toLowerCase()}/`)) return null;
  try {
    const meta = await getDropboxClient().filesGetMetadata({ path: p });
    if (meta.result['.tag'] !== 'file') return null;
    return (meta.result as { path_lower?: string }).path_lower ?? p;
  } catch {
    return null;
  }
}

// Handles the two JSON requests of the direct flow; returns null for anything else so the
// route carries on with its normal (multipart / text-only) handling.
export async function handleDirectUploadRequest(json: NoteJson, folder: string): Promise<DirectResult> {
  if (json.action === 'upload-link') {
    const name = String(json.fileName ?? '');
    if (!isImageAttachment(name)) return { response: NextResponse.json({ error: 'Only images can be uploaded here.' }, { status: 415 }) };
    try {
      return { response: NextResponse.json(await createDirectUploadLink(folder, name)) };
    } catch (e) {
      console.error('[direct upload] link failed:', e instanceof Error ? e.message : e);
      return { response: NextResponse.json({ error: 'Could not start the upload.' }, { status: 502 }) };
    }
  }
  if (typeof json.imagePath === 'string') {
    const verified = await verifyDirectUpload(folder, json.imagePath);
    if (!verified) return { response: NextResponse.json({ error: 'Uploaded file was not found.' }, { status: 400 }) };
    return { imagePath: verified };
  }
  return null;
}
