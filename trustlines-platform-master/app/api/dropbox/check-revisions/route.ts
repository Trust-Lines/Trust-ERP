import { NextRequest, NextResponse } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox/client';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/send';
import { userCan } from '@/lib/permissions/server';
import { logAudit } from '@/lib/audit/log';
import { versionScope, markVersionSetDraft } from '@/lib/versions';

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
    .select('id, file_name, dropbox_path, dropbox_rev, status, version, dropbox_version, revision_count, version_set_id')
    .eq('project_id', projectId)
    .eq('doc_type', docType)
    .order('created_at', { ascending: false })
    .limit(20);
  q = catGroup ? q.eq('cat_group', catGroup) : q.is('cat_group', null);
  const { data: docs } = await q as {
    data: {
      id: string; file_name: string; dropbox_path: string; dropbox_rev: string | null;
      status: string; version: number; dropbox_version: number | null;
      revision_count: number | null; version_set_id: string | null;
    }[] | null;
  };

  if (!docs?.length) return NextResponse.json({ revisions: [] });

  const dbx = getDropboxClient();
  const revisions: { documentId: string; fileName: string; serverModified: string }[] = [];

  for (const doc of docs) {
    if (!doc.dropbox_path) continue;
    let rev = '', serverModified: string | null = null, fileId: string | null = null;
    try {
      const meta = await dbx.filesGetMetadata({ path: doc.dropbox_path });
      if (meta.result['.tag'] !== 'file') continue;
      rev            = (meta.result as { rev?: string }).rev ?? '';
      serverModified = (meta.result as { server_modified?: string }).server_modified ?? null;
      fileId         = (meta.result as { id?: string }).id ?? null;
    } catch { continue; }

    if (!rev || rev === doc.dropbox_rev) continue;
    if (!doc.dropbox_rev) {
      await admin.from('documents').update({ dropbox_rev: rev, dropbox_file_id: fileId }).eq('id', doc.id);
      continue;
    }

    const { data: stage1 } = await admin
      .from('document_approvals')
      .select('assigned_to')
      .eq('document_id', doc.id).eq('project_id', projectId).eq('stage', 1)
      .maybeSingle() as { data: { assigned_to: string | null } | null };

    const resetFields = {
      status:          'draft',
      dropbox_rev:     rev,
      dropbox_file_id: fileId,
      last_revised_at: serverModified,
      revision_count:  (doc.revision_count ?? 0) + 1,
    };
    const updRes = await admin.from('documents').update({ ...resetFields, pf_signatures: [] }).eq('id', doc.id) as { error: { message?: string } | null };
    if (updRes.error && /column|schema cache/i.test(updRes.error.message ?? '')) {
      await admin.from('documents').update(resetFields).eq('id', doc.id);
    }

    await admin.from('document_approvals').delete()
      .eq('document_id', doc.id).eq('project_id', projectId);

    const scope = versionScope(docType, catGroup ?? null);
    if (scope && doc.version_set_id) {
      try { await markVersionSetDraft(admin, doc.version_set_id); } catch { }
    }

    const verNum = doc.dropbox_version ?? doc.version;
    await logAudit({
      actorId: user.id, action: 'document.revision_detected', projectId,
      resource: `${docType} V${verNum} — ${doc.file_name}`,
      newValue: { rev, serverModified, previousRev: doc.dropbox_rev },
    });

    revisions.push({ documentId: doc.id, fileName: doc.file_name, serverModified: serverModified ?? '' });

    try {
      const { data: project } = await admin.from('projects')
        .select('name, code, trustlines_pm_id').eq('id', projectId).single() as {
          data: { name: string; code: string; trustlines_pm_id: string | null } | null;
        };
      const notifyId = stage1?.assigned_to ?? project?.trustlines_pm_id ?? null;
      if (notifyId && project && await userCan(admin, notifyId, 'notify.revision')) {
        const { data: profile } = await admin.from('profiles')
          .select('email, full_name').eq('id', notifyId).single() as {
            data: { email: string | null; full_name: string } | null;
          };
        if (profile?.email) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
          await sendEmail(
            profile.email,
            `[Trust-Lines] Revision Uploaded: ${doc.file_name} — ${project.name}`,
            `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
              <p>Hi ${profile.full_name},</p>
              <p>A revised version of <b>${doc.file_name}</b> (V${verNum}) was uploaded to Dropbox
              for project <b>${project.name}</b> (${project.code}).</p>
              <p>The approval flow has been reset — it is waiting for your review from Stage 1.</p>
              <p><a href="${appUrl}/projects/${projectId}" style="color:#1a6b6b;font-weight:bold">Open the project →</a></p>
            </div>`,
          );
        }
      }
    } catch (e) { console.error('[check-revisions] notify failed:', e); }
  }

  return NextResponse.json({ revisions });
}
