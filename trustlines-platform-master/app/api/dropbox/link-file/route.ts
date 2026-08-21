import { NextRequest, NextResponse } from 'next/server';
import { getDropboxClient } from '@/lib/dropbox/client';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, approvalRequestHtml } from '@/lib/email/send';
import { logAudit } from '@/lib/audit/log';
import { versionScope, attachDocumentToVersionSet } from '@/lib/versions';
import type { DocType } from '@/types/database';

const APPROVAL_DOC_TYPES = ['plan_layout', 'proposal', 'construction_drawings'] as const;

export async function POST(request: NextRequest) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  const body = await request.json() as {
    projectId:    string;
    docType:      string;
    dropboxPath:  string;
    dropboxId:    string;
    fileName:     string;
    dropboxVersion: number;
    prodType?:    string;
    catGroup?:    string;
    stepKey?:     string;
  };

  const { projectId, docType, dropboxPath, dropboxId, fileName, dropboxVersion } = body;
  if (!projectId || !docType || !dropboxPath || !fileName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const dbx = getDropboxClient();
  let fileSizeBytes: number | null = null;
  let dropboxRev: string = '';
  let serverModified: string | null = null;
  try {
    const meta = await dbx.filesGetMetadata({ path: dropboxPath });
    if (meta.result['.tag'] === 'file') {
      fileSizeBytes  = (meta.result as { size?: number }).size ?? null;
      dropboxRev     = (meta.result as { rev?: string }).rev ?? '';
      serverModified = (meta.result as { server_modified?: string }).server_modified ?? null;
    }
  } catch { }

  const ext  = fileName.split('.').pop()?.toLowerCase() ?? '';
  const mime = ext === 'pdf' ? 'application/pdf'
    : ['jpg','jpeg'].includes(ext) ? 'image/jpeg'
    : ext === 'png' ? 'image/png'
    : ext === 'dwg' ? 'application/acad'
    : 'application/octet-stream';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any;

  const { data: maxRow } = await sb
    .from('documents')
    .select('version')
    .eq('project_id', projectId)
    .eq('doc_type', docType)
    .order('version', { ascending: false })
    .limit(1)
    .single();
  const dbVersion = maxRow ? (maxRow as { version: number }).version + 1 : 1;

  const fullPayload = {
    project_id:      projectId,
    doc_type:        docType as DocType,
    version:         dbVersion,
    status:          'draft',
    dropbox_path:    dropboxPath,
    dropbox_file_id: dropboxId,
    dropbox_rev:     dropboxRev,
    file_name:       fileName,
    file_size_bytes: fileSizeBytes,
    mime_type:       mime,
    uploaded_by:     user.id,
    branch:          null,
    notes:           'Synced from Dropbox',
    step_key:        body.stepKey  ?? null,
    cat_group:       body.catGroup ?? null,
    dropbox_version: dropboxVersion,
    prod_type:       body.prodType ?? null,
  };

  let result = await sb.from('documents').insert(fullPayload).select().single();

  if (result.error?.message?.includes('column') || result.error?.message?.includes('schema cache')) {
    const { step_key: _sk, cat_group: _cg, dropbox_version: _dv, prod_type: _pt, ...base } = fullPayload;
    result = await sb.from('documents').insert(base).select().single();
  }

  const { data: doc, error } = result;

  if (error) {
    return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });
  }

  try {
    const vScope = versionScope(docType, body.catGroup ?? null);
    if (vScope) {
      const vset = await attachDocumentToVersionSet(sb, {
        documentId: (doc as { id: string }).id, projectId, docType, catGroup: body.catGroup ?? null,
      });
      if (vset && dropboxRev) {
        await sb.from('document_versions').update({
          dropbox_rev:         dropboxRev,
          dropbox_modified_at: serverModified,
        }).eq('id', vset.id).is('dropbox_rev', null);
      }
      if (dropboxRev) {
        await logAudit({
          actorId: user.id, action: 'version.dropbox_rev_detected', projectId,
          resource: `${vScope} — ${fileName}`, newValue: { rev: dropboxRev, serverModified },
        });
      }
    }
  } catch (e) { console.error('[link-file] version-set attach failed:', e); }

  const catGroup   = body.catGroup ?? null;
  const PROD_APPROVAL_TYPES = ['proposal', 'item_plan', 'item_list', 'price_list', 'book', 'po_bo', 'pf'];
  const isProdApproval = !!catGroup && PROD_APPROVAL_TYPES.includes(docType);
  const isFinApproval  = !catGroup && APPROVAL_DOC_TYPES.includes(docType as typeof APPROVAL_DOC_TYPES[number]);

  if ((isProdApproval || isFinApproval) && doc) {
    const docId = (doc as { id: string }).id;

    const { data: project } = await sb
      .from('projects')
      .select('id, name, code, trustlines_pm_id, tlines_pm_id, prod_pm_ms_id, prod_pm_ci_id')
      .eq('id', projectId).single();

    const trustlinesPmId = (project as { trustlines_pm_id: string | null } | null)?.trustlines_pm_id;
    const tlinesPmId     = (project as { tlines_pm_id:     string | null } | null)?.tlines_pm_id;
    const verLabel       = `V${dropboxVersion ?? 0}`;
    const appUrl         = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const tabSlug        = docType === 'proposal' && !catGroup ? 'design_proposal'
                         : docType === 'construction_drawings' ? 'construction_drawing'
                         : docType === 'item_plan' ? `${catGroup ?? 'millwork'}`
                         : 'plan_layout';
    const actionUrl      = `${appUrl}/projects/${projectId}?tab=${tabSlug}`;
    const docLabel       = docType === 'plan_layout' ? 'Item Plan'
                         : docType === 'item_plan'   ? 'Item Plan'
                         : docType === 'construction_drawings' ? 'Construction Drawing'
                         : 'Proposal';

    const base = { document_id: docId, project_id: projectId, requested_by: user.id, doc_type: docType, version_num: dropboxVersion ?? 0 };

    if (isProdApproval) {
      const catUp    = catGroup.charAt(0).toUpperCase() + catGroup.slice(1);
      const isMS     = ['Millwork', 'Shelving'].includes(catUp);
      const prodPmId = isMS
        ? (project as { prod_pm_ms_id: string | null } | null)?.prod_pm_ms_id
        : (project as { prod_pm_ci_id: string | null } | null)?.prod_pm_ci_id;

      for (const row of [
        { assigned_to: prodPmId ?? null,       status: 'pending', stage: 1 },
        { assigned_to: trustlinesPmId ?? null, status: 'waiting', stage: 2 },
        { assigned_to: tlinesPmId ?? null,     status: 'waiting', stage: 3 },
      ]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (sb as any).rpc('create_document_approval', {
          p_document_id: base.document_id, p_project_id: base.project_id, p_requested_by: base.requested_by,
          p_assigned_to: row.assigned_to, p_status: row.status, p_stage: row.stage,
          p_doc_type: base.doc_type, p_version_num: base.version_num,
        });
      }

      if (prodPmId) {
        const { data: approverProfile } = await sb.from('profiles').select('email, full_name').eq('id', prodPmId).single();
        const { data: uploaderProfile } = await sb.from('profiles').select('full_name').eq('id', user.id).single();
        if ((approverProfile as { email?: string } | null)?.email) {
          try {
            await sendEmail(
              (approverProfile as { email: string }).email,
              `[Trust-Lines] Approval Needed: ${docLabel} ${verLabel} — ${(project as { name: string } | null)?.name}`,
              approvalRequestHtml({
                recipientName: (uploaderProfile as { full_name?: string } | null)?.full_name ?? 'Team',
                approverName:  (approverProfile as { full_name: string }).full_name,
                projectName:   (project as { name: string } | null)?.name ?? projectId,
                projectCode:   (project as { code: string } | null)?.code ?? '',
                docLabel, versionLabel: verLabel, actionUrl,
              }),
            );
          } catch (e) { console.error('[email] prod approval email failed:', e); }
        }
      }
    } else {
      for (const row of [
        { assigned_to: trustlinesPmId ?? null, status: 'pending', stage: 1 },
        { assigned_to: tlinesPmId ?? null,     status: 'waiting', stage: 2 },
      ]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (sb as any).rpc('create_document_approval', {
          p_document_id: base.document_id, p_project_id: base.project_id, p_requested_by: base.requested_by,
          p_assigned_to: row.assigned_to, p_status: row.status, p_stage: row.stage,
          p_doc_type: base.doc_type, p_version_num: base.version_num,
        });
      }

      if (trustlinesPmId) {
        const { data: approverProfile } = await sb.from('profiles').select('email, full_name').eq('id', trustlinesPmId).single();
        const { data: uploaderProfile } = await sb.from('profiles').select('full_name').eq('id', user.id).single();
        if ((approverProfile as { email?: string } | null)?.email) {
          try {
            await sendEmail(
              (approverProfile as { email: string }).email,
              `[Trust-Lines] Approval Needed: ${docLabel} ${verLabel} — ${(project as { name: string } | null)?.name}`,
              approvalRequestHtml({
                recipientName: (uploaderProfile as { full_name?: string } | null)?.full_name ?? 'Team',
                approverName:  (approverProfile as { full_name: string }).full_name,
                projectName:   (project as { name: string } | null)?.name ?? projectId,
                projectCode:   (project as { code: string } | null)?.code ?? '',
                docLabel, versionLabel: verLabel, actionUrl,
              }),
            );
          } catch (e) { console.error('[email] approval email failed:', e); }
        }
      }
    }
  }

  await logAudit({
    actorId:   user.id,
    action:    'document.linked',
    projectId: projectId,
    resource:  `${docType} — ${fileName}`,
    newValue:  { docType, dropboxVersion, fileName },
  });
  return NextResponse.json({ success: true, document: doc });
}
