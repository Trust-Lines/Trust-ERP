import { NextResponse, type NextRequest } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox/client';
import { logAudit } from '@/lib/audit/log';
import { buildNeedFilesPath } from './needFiles';
import { sanitizeFileName } from './prospectFiles';
import { createDirectUploadLink, verifyDirectUpload } from './directUpload';

/* eslint-disable @typescript-eslint/no-explicit-any */

// POST …/opportunities|potentials/[id]/files — a deal file into its Need's Dropbox folder.
//
// Direct flow first (the browser sends the bytes to Dropbox, so the ~4.5 MB serverless body cap
// never applies — big PDFs / drawings failed before):
//   1. JSON { action: 'upload-link', fileName } → { link, path }: a one-shot link that writes one
//      file into this deal's folder only (add + autorename, never overwrites).
//   2. JSON { filePath } once uploaded → checked to be in that folder and to exist, then saved.
// Classic multipart { file } stays as the fallback. The caller has already checked access.
export async function handleNeedFileUpload(req: NextRequest, admin: any, opts: {
  need: { need_id: string; title: string; region: string | null };
  userId: string; auditAction: string; auditRef: Record<string, unknown>; logTag: string;
}): Promise<NextResponse> {
  const { need, userId } = opts;
  const folder = buildNeedFilesPath(need.region, need.title, need.need_id);

  let dropboxPath: string;
  let fileName: string;
  if ((req.headers.get('content-type') ?? '').includes('application/json')) {
    const json = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (json.action === 'upload-link') {
      try {
        return NextResponse.json(await createDirectUploadLink(folder, String(json.fileName ?? '').trim() || 'file'));
      } catch (e) {
        console.error(`${opts.logTag} upload link:`, e instanceof Error ? e.message : e);
        return NextResponse.json({ error: 'Could not start the upload — Dropbox did not answer' }, { status: 502 });
      }
    }
    const verified = typeof json.filePath === 'string' ? await verifyDirectUpload(folder, json.filePath) : null;
    if (!verified) return NextResponse.json({ error: 'The uploaded file was not found in Dropbox' }, { status: 400 });
    dropboxPath = verified;
    fileName = verified.slice(verified.lastIndexOf('/') + 1);
  } else {
    const form = await req.formData().catch(() => null);
    const file = form?.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
    fileName = sanitizeFileName(file.name);
    const path = `${folder}/${fileName}`;
    try {
      const res = await getDropboxClient().filesUpload({ path, contents: Buffer.from(await file.arrayBuffer()), mode: { '.tag': 'add' }, autorename: true });
      dropboxPath = res.result.path_lower ?? path;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Dropbox upload failed';
      console.error(`${opts.logTag}`, msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  const { data: fileRow, error } = await admin.from('need_files').insert({
    need_id: need.need_id, dropbox_path: dropboxPath, file_name: fileName, uploaded_by: userId,
  }).select('id, need_id, dropbox_path, file_name, uploaded_by, created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: userId, action: opts.auditAction, resource: `need_files:${fileRow.id}`, newValue: { ...opts.auditRef, file_name: fileName } });
  return NextResponse.json({ file: { ...fileRow, uploaded_by_name: null } }, { status: 201 });
}
