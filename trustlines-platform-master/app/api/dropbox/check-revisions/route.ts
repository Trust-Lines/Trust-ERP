import { NextRequest, NextResponse } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox/client';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyDocumentRevision, REVISION_DOC_COLS, type RevisionDoc } from '@/lib/dropbox/revisions';

// Tab-open check for overwritten PDFs. The Dropbox webhook does the same the moment a file is
// saved (lib/dropbox/autoSync.ts); this stays as the fallback and for files from before it.
export async function POST(request: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  const { projectId, docType, catGroup } = await request.json() as {
    projectId: string; docType: string; catGroup?: string | null;
  };
  if (!projectId || !docType) {
    return NextResponse.json({ error: 'projectId and docType required' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  let q = admin
    .from('documents')
    .select(REVISION_DOC_COLS)
    .eq('project_id', projectId)
    .eq('doc_type', docType)
    .order('created_at', { ascending: false })
    .limit(20);
  q = catGroup ? q.eq('cat_group', catGroup) : q.is('cat_group', null);
  const { data: docs } = await q as { data: RevisionDoc[] | null };
  if (!docs?.length) return NextResponse.json({ revisions: [] });

  const dbx = getDropboxClient();
  const revisions: { documentId: string; fileName: string; serverModified: string }[] = [];

  for (const doc of docs) {
    if (!doc.dropbox_path) continue;
    let file;
    try {
      const meta = await dbx.filesGetMetadata({ path: doc.dropbox_path });
      if (meta.result['.tag'] !== 'file') continue;
      file = meta.result;
    } catch { continue; }

    const serverModified = file.server_modified ?? null;
    if (await applyDocumentRevision(admin, doc, { rev: file.rev ?? '', serverModified, fileId: file.id ?? null }, user.id)) {
      revisions.push({ documentId: doc.id, fileName: doc.file_name, serverModified: serverModified ?? '' });
    }
  }

  return NextResponse.json({ revisions });
}
