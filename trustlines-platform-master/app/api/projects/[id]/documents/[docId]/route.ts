import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';

type Params = { params: Promise<{ id: string; docId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const { id: projectId, docId } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data } = await admin.from('documents')
    .select('id, form_data, pf_meta, pf_signatures')
    .eq('id', docId).eq('project_id', projectId).maybeSingle() as {
      data: { id: string; form_data: unknown; pf_meta: unknown; pf_signatures: unknown } | null;
    };
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const { id: projectId, docId } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: doc } = await admin
    .from('documents')
    .select('id, project_id, doc_type, status, file_name, dropbox_path')
    .eq('id', docId).eq('project_id', projectId).single() as {
      data: { id: string; project_id: string; doc_type: string; status: string; file_name: string; dropbox_path: string | null } | null;
    };
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  if (doc.status === 'approved') {
    return NextResponse.json({ error: 'Approved documents cannot be deleted' }, { status: 409 });
  }

  await admin.from('document_approvals').delete().eq('document_id', docId).eq('project_id', projectId);
  const { error } = await admin.from('documents').delete().eq('id', docId).eq('project_id', projectId);
  if (error) return NextResponse.json({ error: error.message ?? 'Delete failed' }, { status: 500 });

  // The file stays in Dropbox (docs/AGENTS.md §4 — the app never deletes there; documents are now
  // also imported from people's own files). Its path is kept on the audit row so the Dropbox sync
  // doesn't bring the document back (lib/dropbox/autoSync → dismissedPaths).
  await logAudit({
    actorId: user.id, action: 'document.deleted', projectId, resource: `${doc.doc_type} — ${doc.file_name}`,
    newValue: doc.dropbox_path ? { dropbox_path: doc.dropbox_path, kept_in_dropbox: true } : null,
  });
  return NextResponse.json({ ok: true });
}
