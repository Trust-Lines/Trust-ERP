// A document's PDF was overwritten in Dropbox (same path, new rev): the approval flow starts over.
// Shared by the tab-open check (/api/dropbox/check-revisions) and the Dropbox change feed
// (lib/dropbox/autoSync.ts — webhook + cron), so a revision lands the moment it's saved.

import { sendEmail } from '@/lib/email/send';
import { userCan } from '@/lib/permissions/server';
import { logAudit } from '@/lib/audit/log';
import { versionScope, markVersionSetDraft } from '@/lib/versions';
import { appBaseUrl } from '@/lib/env/appUrl';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const REVISION_DOC_COLS = 'id, project_id, doc_type, cat_group, file_name, dropbox_path, dropbox_rev, status, version, dropbox_version, revision_count, version_set_id';

export interface RevisionDoc {
  id: string; project_id: string; doc_type: string; cat_group: string | null;
  file_name: string; dropbox_path: string; dropbox_rev: string | null;
  status: string; version: number; dropbox_version: number | null;
  revision_count: number | null; version_set_id: string | null;
}

export interface FileMeta { rev: string; serverModified: string | null; fileId: string | null }

/**
 * Compare the document with the file's current Dropbox metadata. Unknown rev → just remembered.
 * New rev → status draft, approvals cleared, version set back to draft, audit + email to Stage 1
 * (or the project's T-Lines PM). Returns true when a revision was applied.
 */
export async function applyDocumentRevision(admin: any, doc: RevisionDoc, meta: FileMeta, actorId: string | null): Promise<boolean> {
  const { rev, serverModified, fileId } = meta;
  if (!rev || rev === doc.dropbox_rev) return false;
  if (!doc.dropbox_rev) {
    await admin.from('documents').update({ dropbox_rev: rev, dropbox_file_id: fileId }).eq('id', doc.id);
    return false;
  }

  const { data: stage1 } = await admin
    .from('document_approvals')
    .select('assigned_to')
    .eq('document_id', doc.id).eq('project_id', doc.project_id).eq('stage', 1)
    .maybeSingle() as { data: { assigned_to: string | null } | null };

  const resetFields = {
    status:          'draft',
    dropbox_rev:     rev,
    dropbox_file_id: fileId,
    last_revised_at: serverModified,
    revision_count:  (doc.revision_count ?? 0) + 1,
  };
  // Conditional on the old rev: the webhook and a tab-open check racing apply it once.
  const upd = await admin.from('documents').update({ ...resetFields, pf_signatures: [] })
    .eq('id', doc.id).eq('dropbox_rev', doc.dropbox_rev).select('id') as { data: { id: string }[] | null; error: { message?: string } | null };
  let applied = !!upd.data?.length;
  if (upd.error && /column|schema cache/i.test(upd.error.message ?? '')) {
    const r2 = await admin.from('documents').update(resetFields).eq('id', doc.id).eq('dropbox_rev', doc.dropbox_rev).select('id');
    applied = !!r2.data?.length;
  }
  if (!applied) return false;

  await admin.from('document_approvals').delete().eq('document_id', doc.id).eq('project_id', doc.project_id);

  const scope = versionScope(doc.doc_type, doc.cat_group ?? null);
  if (scope && doc.version_set_id) {
    try { await markVersionSetDraft(admin, doc.version_set_id); } catch { /* best effort */ }
  }

  const verNum = doc.dropbox_version ?? doc.version;
  await logAudit({
    actorId, action: 'document.revision_detected', projectId: doc.project_id,
    resource: `${doc.doc_type} V${verNum} — ${doc.file_name}`,
    newValue: { rev, serverModified, previousRev: doc.dropbox_rev },
  });

  try {
    const { data: project } = await admin.from('projects')
      .select('name, code, trustlines_pm_id').eq('id', doc.project_id).single() as {
        data: { name: string; code: string; trustlines_pm_id: string | null } | null;
      };
    const notifyId = stage1?.assigned_to ?? project?.trustlines_pm_id ?? null;
    if (notifyId && project && await userCan(admin, notifyId, 'notify.revision')) {
      const { data: profile } = await admin.from('profiles')
        .select('email, full_name').eq('id', notifyId).single() as { data: { email: string | null; full_name: string } | null };
      if (profile?.email) {
        await sendEmail(
          profile.email,
          `[Trust-Lines] Revision Uploaded: ${doc.file_name} — ${project.name}`,
          `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
            <p>Hi ${profile.full_name},</p>
            <p>A revised version of <b>${doc.file_name}</b> (V${verNum}) was uploaded to Dropbox
            for project <b>${project.name}</b> (${project.code}).</p>
            <p>The approval flow has been reset — it is waiting for your review from Stage 1.</p>
            <p><a href="${appBaseUrl()}/projects/${doc.project_id}" style="color:#1a6b6b;font-weight:bold">Open the project →</a></p>
          </div>`,
        );
      }
    }
  } catch (e) { console.error('[revision] notify failed:', e); }
  return true;
}
