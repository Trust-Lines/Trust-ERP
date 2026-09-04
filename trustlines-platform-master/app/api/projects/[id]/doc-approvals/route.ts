import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, approvalRequestHtml, approvalCompletedHtml, approvalRejectedHtml } from '@/lib/email/send';
import { logAudit } from '@/lib/audit/log';
import { emitEvent } from '@/lib/events';
import { catGroupToType } from '@/lib/production/board';
import { applySignaturesToDocument } from '@/lib/pdf/signPdf';
import { approvalStagesFor, mandatoryStageCount, signPermForStage } from '@/lib/approvals/stageConfig';
import { roleCan, userCan } from '@/lib/permissions/server';
import { ensureVersionFolder } from '@/lib/dropbox/upload';
import { appBaseUrl } from '@/lib/env/appUrl';
import {
  versionScope, getOrCreateOpenVersionSet, markVersionSetSigned,
  markVersionSetCompleted, rejectVersionSetAndOpenNext, attachDocumentToVersionSet,
} from '@/lib/versions';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  const { id: projectId } = await params;
  const { searchParams }  = new URL(request.url);
  const documentId        = searchParams.get('documentId');
  if (!documentId) return NextResponse.json({ approvals: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data } = await admin
    .from('document_approvals')
    .select('id, stage, status, assigned_to, approved_by, notes, created_at, resolved_at, version_num')
    .eq('project_id', projectId)
    .eq('document_id', documentId)
    .order('stage', { ascending: true });

  return NextResponse.json({ approvals: data ?? [] });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  const { id: projectId } = await params;
  const body = await request.json() as {
    action:      'approve' | 'reject' | 'initiate';
    approvalId?: string;
    notes?:      string;
    documentId?: string;
    docType?:    string;
    catGroup?:   string | null;
    versionNum?: number;
  };

  if (body.action === 'initiate') {
    const { documentId, docType, catGroup, versionNum } = body;
    if (!documentId) return NextResponse.json({ error: 'documentId required' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;

    const { data: existing } = await admin
      .from('document_approvals').select('id, status')
      .eq('document_id', documentId).eq('project_id', projectId);

    const isPfChk = docType === 'pf';
    const cfgStages = isPfChk ? [] : approvalStagesFor(docType ?? '', catGroup ?? null);
    const expectedStages = isPfChk ? 4 : cfgStages.length;

    let appendFromStage = 0;
    if (existing && existing.length > 0) {
      if (existing.length >= expectedStages) {
        return NextResponse.json({ error: 'Approval workflow already exists for this document' }, { status: 409 });
      }
      const hasResolved = (existing as { status: string }[]).some(r => ['approved', 'rejected'].includes(r.status));
      if (hasResolved) {
        appendFromStage = existing.length + 1;
      } else {
        await admin.from('document_approvals').delete()
          .eq('document_id', documentId).eq('project_id', projectId);
      }
    }

    const { data: project } = await admin
      .from('projects')
      .select('id, name, code, trustlines_pm_id, tlines_pm_id, prod_pm_ms_id, prod_pm_ci_id')
      .eq('id', projectId).single();

    const trustlinesPmId = (project as { trustlines_pm_id: string | null } | null)?.trustlines_pm_id;
    const tlinesPmId     = (project as { tlines_pm_id:     string | null } | null)?.tlines_pm_id;

    const base = { document_id: documentId, project_id: projectId, requested_by: user.id, doc_type: docType ?? null, version_num: versionNum ?? 0 };

    const isPf = docType === 'pf';
    const inserts: Array<{ stage: number; assigned_to: string | null; status: string }> = [];

    if (isPf) {
      const { data: roleUsers } = await admin.from('profiles').select('id, role')
        .in('role', ['production_manager', 'project_manager', 'general_manager', 'accountant']) as {
          data: { id: string; role: string }[] | null;
        };
      const byRole = new Map<string, string>();
      for (const u of roleUsers ?? []) if (!byRole.has(u.role)) byRole.set(u.role, u.id);
      inserts.push({ stage: 1, assigned_to: byRole.get('production_manager') ?? null, status: 'pending' });
      inserts.push({ stage: 2, assigned_to: byRole.get('project_manager')    ?? null, status: 'waiting' });
      inserts.push({ stage: 3, assigned_to: byRole.get('general_manager')     ?? null, status: 'waiting' });
      inserts.push({ stage: 4, assigned_to: byRole.get('accountant')          ?? null, status: 'pending' });
    } else {
      const stages = cfgStages;
      const catUp  = (catGroup ?? '').charAt(0).toUpperCase() + (catGroup ?? '').slice(1);
      const isMS   = ['Millwork', 'Shelving'].includes(catUp);
      const prodPmId = isMS
        ? (project as { prod_pm_ms_id: string | null } | null)?.prod_pm_ms_id ?? null
        : (project as { prod_pm_ci_id: string | null } | null)?.prod_pm_ci_id ?? null;
      let projSupervisorId: string | null = null;
      if (stages.some(s => s.assignee === 'pm_supervisor')) {
        const supRes = await admin.from('projects').select('pm_supervisor_id').eq('id', projectId).maybeSingle() as { data: { pm_supervisor_id: string | null } | null; error: unknown };
        projSupervisorId = supRes.data?.pm_supervisor_id ?? null;
      }
      const needGlobal = stages.some(s => ['general_manager', 'accountant', 'pm_supervisor'].includes(s.assignee));
      const byRole = new Map<string, string>();
      if (needGlobal) {
        const { data: roleUsers } = await admin.from('profiles').select('id, role').in('role', ['general_manager', 'accountant', 'ops_manager']) as { data: { id: string; role: string }[] | null };
        for (const u of roleUsers ?? []) if (!byRole.has(u.role)) byRole.set(u.role, u.id);
      }
      const resolve = (key: string): string | null => {
        switch (key) {
          case 'production_pm':   return prodPmId;
          case 'trust_pm':        return trustlinesPmId ?? null;
          case 'client_pm':       return tlinesPmId ?? null;
          case 'general_manager': return byRole.get('general_manager') ?? null;
          case 'accountant':      return byRole.get('accountant') ?? null;
          case 'pm_supervisor':   return projSupervisorId ?? byRole.get('ops_manager') ?? null;
          default:                return null;
        }
      };
      stages.forEach((s, i) => inserts.push({ stage: i + 1, assigned_to: resolve(s.assignee), status: (s.anytime || i === 0) ? 'pending' : 'waiting' }));
    }

    let rowsToInsert = inserts;
    if (appendFromStage > 0) {
      const allExistingApproved = (existing as { status: string }[]).every(r => r.status === 'approved');
      rowsToInsert = inserts
        .filter(r => r.stage >= appendFromStage)
        .map(r => {
          const anytime = !!cfgStages[r.stage - 1]?.anytime;
          const pend = anytime || (r.stage === appendFromStage && allExistingApproved);
          return { ...r, status: pend ? 'pending' : 'waiting' };
        });
    }

    for (const row of rowsToInsert) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insErr } = await (admin as any).rpc('create_document_approval', {
        p_document_id:  base.document_id,
        p_project_id:   base.project_id,
        p_requested_by: base.requested_by,
        p_assigned_to:  row.assigned_to,
        p_status:       row.status,
        p_stage:        row.stage,
        p_doc_type:     base.doc_type ?? '',
        p_version_num:  base.version_num,
      });
      if (insErr) {
        console.error('[doc-approvals] rpc insert failed stage', row.stage, insErr.message);
        return NextResponse.json({ error: `Stage ${row.stage} insert failed: ${insErr.message}` }, { status: 500 });
      }
    }

    try {
      await attachDocumentToVersionSet(admin, { documentId, projectId, docType: docType ?? '', catGroup: catGroup ?? null });
    } catch (e) { console.error('[doc-approvals] version-set attach failed:', e); }

    await logAudit({ actorId: user.id, action: 'approval.initiated', projectId, resource: docType ?? '' });
    return NextResponse.json({ success: true });
  }

  const body2 = body as { action: 'approve' | 'reject'; approvalId: string; notes?: string };

  const { action, approvalId, notes } = body2;
  if (!action || !approvalId) {
    return NextResponse.json({ error: 'action and approvalId required' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: approval, error: apErr } = await admin
    .from('document_approvals')
    .select('id, stage, status, assigned_to, document_id, doc_type, version_num, project_id')
    .eq('id', approvalId)
    .eq('project_id', projectId)
    .single();

  if (apErr || !approval) return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
  if (approval.status !== 'pending') return NextResponse.json({ error: 'Already resolved' }, { status: 409 });

  const { data: docCheck } = await admin.from('documents').select('status, cat_group, version_set_id')
    .eq('id', approval.document_id).single() as {
      data: { status?: string; cat_group: string | null; version_set_id: string | null } | null;
    };
  if (docCheck?.status === 'rejected') {
    return NextResponse.json({ error: 'This version has been rejected. Please upload a new version to restart the approval.' }, { status: 409 });
  }

  const { data: actorProfile } = await admin.from('profiles').select('role').eq('id', user.id).single() as { data: { role: string } | null };
  const actorRole = actorProfile?.role ?? '';
  const stageDef  = approval.doc_type === 'pf' ? null : approvalStagesFor(approval.doc_type ?? '', docCheck?.cat_group ?? null)[approval.stage - 1];
  const needPerm = signPermForStage(approval.doc_type ?? '', docCheck?.cat_group ?? null, approval.stage);
  const canAct = approval.assigned_to === user.id || (!!needPerm && await roleCan(admin, actorRole, needPerm));
  if (!canAct) {
    return NextResponse.json({ error: 'Not authorized to act on this approval' }, { status: 403 });
  }

  const SHARED_GUARD = ['proposal', 'item_plan', 'item_list', 'price_list'];
  if (action === 'approve' && docCheck?.cat_group && SHARED_GUARD.includes(approval.doc_type ?? '')) {
    const catUp = docCheck.cat_group.charAt(0).toUpperCase() + docCheck.cat_group.slice(1);
    const required = ['Millwork', 'Shelving'].includes(catUp)
      ? ['proposal', 'item_plan', 'item_list', 'price_list']
      : ['item_plan', 'item_list', 'price_list'];
    const { data: existing } = await admin.from('documents')
      .select('doc_type').eq('project_id', projectId).eq('cat_group', docCheck.cat_group)
      .in('doc_type', required) as { data: { doc_type: string }[] | null };
    const present = new Set((existing ?? []).map(d => d.doc_type));
    const missing = required.filter(t => !present.has(t));
    if (missing.length) {
      const LBL: Record<string, string> = { proposal: 'Proposal', item_plan: 'Item Plan', item_list: 'Item List', price_list: 'Item Price List' };
      return NextResponse.json({ error: `Waiting for: ${missing.map(t => LBL[t] ?? t).join(', ')}` }, { status: 409 });
    }
  }

  if (action === 'approve' && approval.doc_type === 'pf' && docCheck?.cat_group) {
    const cat = docCheck.cat_group;
    const PREREQS: { type: string; cat: string | null; label: string }[] = [
      { type: 'plan_layout', cat: null, label: 'Plan Layout' },
      { type: 'item_list',   cat,       label: 'Item List' },
      { type: 'price_list',  cat,       label: 'Item Price List' },
      { type: 'book',        cat,       label: 'Book' },
      { type: 'po_bo',       cat,       label: 'PO' },
    ];
    const missing: string[] = [];
    for (const p of PREREQS) {
      let q = admin.from('documents').select('id', { count: 'exact', head: true })
        .eq('project_id', projectId).eq('doc_type', p.type).eq('status', 'approved');
      q = p.cat ? q.eq('cat_group', p.cat) : q.is('cat_group', null);
      const { count } = await q as { count: number | null };
      if (!count) missing.push(p.label);
    }
    if (missing.length) {
      return NextResponse.json({ error: `PF can't be signed yet — waiting for: ${missing.join(', ')}` }, { status: 409 });
    }
  }

  const scope = versionScope(approval.doc_type ?? '', docCheck?.cat_group ?? null);
  const { count: stageCount } = await admin
    .from('document_approvals')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', approval.document_id)
    .eq('project_id', projectId) as { count: number | null };
  const cfgStagesAll = approval.doc_type === 'pf' ? [] : approvalStagesFor(approval.doc_type ?? '', docCheck?.cat_group ?? null);
  const isPfAccountant = approval.doc_type === 'pf' && approval.stage === 4;
  const isAnytime    = stageDef?.anytime === true || isPfAccountant;
  const anytimeCount = approval.doc_type === 'pf' ? 1 : cfgStagesAll.filter(s => s.anytime).length;
  const totalStages    = (stageCount ?? 0) - anytimeCount;
  const isTrustPmStage = totalStages >= 2 && approval.stage === totalStages - 1;
  const isClientPmStage = totalStages >= 2 && approval.stage === totalStages;

  if (action === 'reject' && scope && isClientPmStage && !notes?.trim()) {
    return NextResponse.json({ error: 'A rejection reason is required' }, { status: 400 });
  }

  const now = new Date().toISOString();
  await admin
    .from('document_approvals')
    .update({ status: action === 'approve' ? 'approved' : 'rejected', approved_by: user.id, resolved_at: now, notes: notes ?? null })
    .eq('id', approvalId);

  let signatureApplied = false;
  let nextVersionOpened: number | null = null;
  if (action === 'approve') {
    try {
      const sigResult = await Promise.race([
        applySignaturesToDocument({ documentId: approval.document_id, projectId, admin }),
        new Promise<boolean>(resolve => setTimeout(() => resolve(false), 10000)),
      ]);
      signatureApplied = sigResult === true;
    } catch (e) {
      console.error('[sign] signature application failed:', e);
    }
  }

  if (isAnytime) {
    await logAudit({ actorId: user.id, action: action === 'approve' ? 'approval.approve' : 'approval.reject', projectId, resource: `${approval.doc_type} — ${stageDef?.label ?? 'Supervisor'}` });
    return NextResponse.json({ success: true, signatureApplied });
  }

  const { data: project } = await admin
    .from('projects')
    .select('id, name, code, trustlines_pm_id, tlines_pm_id, dropbox_root_path')
    .eq('id', projectId)
    .single();

  const appUrl  = appBaseUrl();
  const tabSlug = approval.doc_type === 'proposal' ? 'design_proposal'
                : approval.doc_type === 'construction_drawings' ? 'construction_drawing'
                : 'plan_layout';
  const actionUrl = `${appUrl}/projects/${projectId}?tab=${tabSlug}`;
  const docLabel   = approval.doc_type === 'plan_layout' ? 'Item Plan' : 'Design Proposal';
  const verLabel   = `V${approval.version_num ?? 0}`;

  const DOC_TYPE_STEP: Record<string, { phase: string; step_key: string }> = {
    plan_layout:           { phase: 'phase1', step_key: 'plan_layout' },
    proposal:              { phase: 'phase1', step_key: 'design_proposal' },
    construction_drawings: { phase: 'phase2', step_key: 'construction_drawings' },
  };

  async function upsertStep(status: string, extra: Record<string, unknown> = {}) {
    const stepInfo = DOC_TYPE_STEP[approval.doc_type ?? ''];
    if (!stepInfo) return;
    const { data: existing } = await admin
      .from('project_steps').select('id')
      .eq('project_id', projectId).eq('phase', stepInfo.phase)
      .eq('step_key', stepInfo.step_key).is('cat_group', null).maybeSingle();
    if (existing) {
      await admin.from('project_steps').update({ status, ...extra }).eq('id', existing.id);
    } else {
      await admin.from('project_steps').insert({
        project_id: projectId, phase: stepInfo.phase, step_key: stepInfo.step_key,
        cat_group: null, status, completed_at: now, completed_by: user!.id, ...extra,
      });
    }
  }

  if (action === 'approve') {
    const { data: nextStageRec } = await admin
      .from('document_approvals')
      .select('id, assigned_to')
      .eq('document_id', approval.document_id)
      .eq('project_id', projectId)
      .eq('stage', approval.stage + 1)
      .maybeSingle() as { data: { id: string; assigned_to: string | null } | null };

    if (scope) {
      try {
        const vset = await getOrCreateOpenVersionSet(admin, projectId, scope);
        if (!docCheck?.version_set_id) {
          await admin.from('documents').update({ version_set_id: vset.id }).eq('id', approval.document_id);
        }
        if (isTrustPmStage) {
          await markVersionSetSigned(admin, vset.id);
          await logAudit({ actorId: user.id, action: 'version.signed', projectId, resource: `${scope} V${vset.version_number}` });
        } else if (isClientPmStage) {
          const { data: setDocs } = await admin.from('documents')
            .select('id, status').eq('version_set_id', vset.id) as { data: { id: string; status: string }[] | null };
          const allApproved = (setDocs ?? []).every(d => d.id === approval.document_id || d.status === 'approved');
          if (allApproved) {
            await markVersionSetCompleted(admin, vset.id);
            await logAudit({ actorId: user.id, action: 'version.completed', projectId, resource: `${scope} V${vset.version_number}` });
          }
        }
      } catch (e) { console.error('[doc-approvals] version-set transition failed:', e); }
    }

    {
      const mandatory = approval.doc_type === 'pf' ? 3 : mandatoryStageCount(approval.doc_type ?? '', docCheck?.cat_group ?? null);
      if (approval.stage >= mandatory && mandatory > 0) {
        const { data: mand } = await admin.from('document_approvals')
          .select('status').eq('document_id', approval.document_id).eq('project_id', projectId).lte('stage', mandatory) as { data: { status: string }[] | null };
        const allMandApproved = (mand ?? []).length >= mandatory && (mand ?? []).every(r => r.status === 'approved');
        if (allMandApproved) {
          await admin.from('documents').update({ status: 'approved', approved_at: now, approved_by: user.id }).eq('id', approval.document_id);
        }
      }
    }

    if (nextStageRec) {
      await admin.from('document_approvals').update({ status: 'pending' }).eq('id', nextStageRec.id);

      if (approval.stage === 1 && approval.doc_type && DOC_TYPE_STEP[approval.doc_type]) {
        const { data: curDoc } = await admin.from('documents').select('dropbox_version, version')
          .eq('id', approval.document_id).single() as { data: { dropbox_version: number | null; version: number } | null };
        const curVer = curDoc?.dropbox_version ?? curDoc?.version ?? null;
        let docQ = admin.from('documents').select('id').eq('project_id', projectId).eq('doc_type', approval.doc_type);
        if (curVer != null) docQ = docQ.eq('dropbox_version', curVer);
        const { data: versionDocs } = await docQ as { data: { id: string }[] | null };
        const versionDocIds = (versionDocs ?? []).map((d: { id: string }) => d.id);
        const { data: allStage1 } = versionDocIds.length > 0
          ? await admin.from('document_approvals').select('status').in('document_id', versionDocIds).eq('stage', 1)
          : { data: null };
        const allS1Approved = allStage1 && allStage1.length > 0 &&
          allStage1.length === versionDocIds.length &&
          (allStage1 as { status: string }[]).every(r => r.status === 'approved');
        if (allS1Approved) {
          await upsertStep('done', { notes: 'Awaiting final PM approval', approved_by: null, approved_at: null, version_approved: null });
        }
      }

      if (nextStageRec.assigned_to && await userCan(admin, nextStageRec.assigned_to, 'notify.approval_request')) {
        const { data: approverProfile } = await admin.from('profiles').select('email, full_name').eq('id', nextStageRec.assigned_to).single();
        const { data: actorProfile }    = await admin.from('profiles').select('full_name').eq('id', user.id).single();
        if ((approverProfile as { email?: string } | null)?.email) {
          try {
            await sendEmail(
              (approverProfile as { email: string }).email,
              `[Trust-Lines] Approval Needed: ${docLabel} ${verLabel} — ${project?.name}`,
              approvalRequestHtml({
                recipientName: (actorProfile as { full_name?: string } | null)?.full_name ?? 'Team',
                approverName:  (approverProfile as { full_name: string }).full_name,
                projectName:   project?.name ?? projectId,
                projectCode:   project?.code ?? '',
                docLabel, versionLabel: verLabel, actionUrl,
              }),
            );
          } catch (e) { console.error('[email] next-stage email failed:', e); }
        }
      }

    } else {
      await admin.from('documents')
        .update({ status: 'approved', approved_at: now, approved_by: user.id })
        .eq('id', approval.document_id);

      if (approval.doc_type && DOC_TYPE_STEP[approval.doc_type]) {
        const { data: curDocF } = await admin.from('documents').select('dropbox_version, version')
          .eq('id', approval.document_id).single() as { data: { dropbox_version: number | null; version: number } | null };
        const curVerF = curDocF?.dropbox_version ?? curDocF?.version ?? null;
        let docQF = admin.from('documents').select('id').eq('project_id', projectId).eq('doc_type', approval.doc_type);
        if (curVerF != null) docQF = docQF.eq('dropbox_version', curVerF);
        const { data: versionDocsF } = await docQF as { data: { id: string }[] | null };
        const versionDocIdsF = (versionDocsF ?? []).map((d: { id: string }) => d.id);
        const { data: allFinal } = versionDocIdsF.length > 0
          ? await admin.from('document_approvals').select('status').in('document_id', versionDocIdsF).eq('stage', approval.stage)
          : { data: null };
        const allFinalApproved = allFinal && allFinal.length > 0 &&
          allFinal.length === versionDocIdsF.length &&
          (allFinal as { status: string }[]).every(r => r.status === 'approved');
        if (allFinalApproved) {
          await upsertStep('approved', {
            approved_by: user.id, approved_at: now,
            version_approved: curDocF?.dropbox_version ?? curDocF?.version ?? null, notes: null,
          });
        }
      }

      if (project?.trustlines_pm_id && await userCan(admin, project.trustlines_pm_id, 'notify.approval_complete')) {
        const { data: notifyProfile } = await admin.from('profiles').select('email, full_name').eq('id', project.trustlines_pm_id).single();
        const { data: actorProfile }  = await admin.from('profiles').select('full_name').eq('id', user.id).single();
        if ((notifyProfile as { email?: string } | null)?.email) {
          try {
            await sendEmail(
              (notifyProfile as { email: string }).email,
              `[Trust-Lines] Fully Approved: ${docLabel} ${verLabel} — ${project?.name}`,
              approvalCompletedHtml({
                approverName: (actorProfile as { full_name?: string } | null)?.full_name ?? 'Client PM',
                projectName:  project?.name ?? projectId,
                projectCode:  project?.code ?? '',
                docLabel, versionLabel: verLabel, actionUrl, allApproved: true,
              }),
            );
          } catch (e) { console.error('[email] completion email failed:', e); }
        }
      }

      if (approval.doc_type === 'po_bo') {
        await emitEvent(admin, {
          type: 'po.chain_complete',
          entityTable: 'documents',
          entityId: approval.document_id,
          projectId,
          actorId: user.id,
          payload: { typeName: catGroupToType(docCheck?.cat_group ?? null) },
        });
      }
    }
  } else if (action === 'reject') {
    await admin.from('documents').update({ status: 'rejected' }).eq('id', approval.document_id);
    await admin.from('document_approvals')
      .update({ status: 'rejected', resolved_at: now, notes: 'Cancelled due to rejection at previous stage' })
      .eq('document_id', approval.document_id).eq('project_id', projectId)
      .eq('status', 'pending').neq('id', approvalId);

    if (scope && isClientPmStage) {
      try {
        const vset = await getOrCreateOpenVersionSet(admin, projectId, scope);
        const next = await rejectVersionSetAndOpenNext(admin, {
          projectId, scope,
          currentSetId:    vset.id,
          dropboxRootPath: (project as { dropbox_root_path?: string | null } | null)?.dropbox_root_path ?? null,
          actorId:         user.id,
        });
        nextVersionOpened = next.version_number;
      } catch (e) { console.error('[doc-approvals] version-set rejection failed:', e); }
    }

    if (!scope && isClientPmStage && ['plan_layout', 'proposal'].includes(approval.doc_type ?? '')) {
      try {
        const rootPath = (project as { dropbox_root_path?: string | null } | null)?.dropbox_root_path;
        if (rootPath) {
          const { data: docVer } = await admin.from('documents')
            .select('version, dropbox_version').eq('id', approval.document_id).single() as {
              data: { version: number; dropbox_version: number | null } | null;
            };
          const curV  = docVer?.dropbox_version ?? docVer?.version ?? approval.version_num ?? 0;
          const nextV = curV + 1;
          await ensureVersionFolder(rootPath, approval.doc_type, nextV);
          nextVersionOpened = nextV;
          await logAudit({
            actorId: user.id, action: 'version.folder_created', projectId,
            resource: `${approval.doc_type} V${nextV}`,
            newValue: { reason: 'client_pm_rejection', previousVersion: curV },
          });
        }
      } catch (e) { console.error('[doc-approvals] V-folder creation failed:', e); }
    }

    const stepInfo = DOC_TYPE_STEP[approval.doc_type ?? ''];
    if (stepInfo) {
      const { data: rejectorProfile } = await admin
        .from('profiles').select('full_name').eq('id', user.id).single();
      const rejectorName = (rejectorProfile as { full_name?: string } | null)?.full_name ?? 'Unknown';
      const stepNote = notes
        ? `Rejected by ${rejectorName}: ${notes}`
        : `Rejected by ${rejectorName}`;
      const { data: existingStep } = await admin.from('project_steps').select('id')
        .eq('project_id', projectId).eq('phase', stepInfo.phase)
        .eq('step_key', stepInfo.step_key).is('cat_group', null).maybeSingle();
      if (existingStep) {
        await admin.from('project_steps').update({
          status: 'rejected', notes: stepNote,
        }).eq('id', existingStep.id);
      }
    }

    if (approval.stage === 2 && project?.trustlines_pm_id) {
      const { data: notifyProfile } = await admin
        .from('profiles').select('email, full_name').eq('id', project.trustlines_pm_id).single();
      const { data: actorProfile } = await admin
        .from('profiles').select('full_name').eq('id', user.id).single();
      if ((notifyProfile as { email?: string } | null)?.email) {
        try {
          await sendEmail(
            (notifyProfile as { email: string }).email,
            `[Trust-Lines] Rejected: ${docLabel} ${verLabel} — ${project?.name}`,
            approvalRejectedHtml({
              rejectorName:  (actorProfile as { full_name?: string } | null)?.full_name ?? 'Client PM',
              recipientName: (notifyProfile as { full_name?: string } | null)?.full_name ?? 'Trust PM',
              projectName:   project?.name  ?? projectId,
              projectCode:   project?.code  ?? '',
              docLabel, versionLabel: verLabel, actionUrl,
              notes: notes ?? undefined,
            }),
          );
        } catch (e) { console.error('[email] reject email failed:', e); }
      }
    }
  }

  const SHARED = ['proposal', 'item_plan', 'item_list', 'price_list'];
  if (action === 'approve' && SHARED.includes(approval.doc_type ?? '')) {
    try {
      const { data: curDoc } = await admin.from('documents')
        .select('dropbox_version, version, cat_group').eq('id', approval.document_id).single() as {
          data: { dropbox_version: number | null; version: number; cat_group: string | null } | null;
        };
      const curVer = curDoc?.dropbox_version ?? curDoc?.version ?? null;
      if (!curDoc?.cat_group) throw new Error('no-cascade');
      const { data: siblings } = await admin.from('documents')
        .select('id, dropbox_version, version')
        .eq('project_id', projectId).eq('cat_group', curDoc.cat_group)
        .in('doc_type', SHARED).neq('id', approval.document_id) as {
          data: { id: string; dropbox_version: number | null; version: number }[] | null;
        };
      for (const sib of siblings ?? []) {
        if ((sib.dropbox_version ?? sib.version) !== curVer) continue;
        const { data: sibStage } = await admin.from('document_approvals')
          .select('id, status').eq('document_id', sib.id).eq('project_id', projectId).eq('stage', approval.stage).maybeSingle() as {
            data: { id: string; status: string } | null;
          };
        if (!sibStage || sibStage.status === 'approved') continue;
        await admin.from('document_approvals')
          .update({ status: 'approved', approved_by: user.id, resolved_at: now, notes: notes ?? 'Signed together with the item documents' })
          .eq('id', sibStage.id);
        await applySignaturesToDocument({ documentId: sib.id, projectId, admin }).catch(() => {});
        const { data: sibNext } = await admin.from('document_approvals')
          .select('id').eq('document_id', sib.id).eq('project_id', projectId).eq('stage', approval.stage + 1).maybeSingle() as { data: { id: string } | null };
        if (sibNext) {
          await admin.from('document_approvals').update({ status: 'pending' }).eq('id', sibNext.id);
        } else {
          await admin.from('documents').update({ status: 'approved', approved_at: now, approved_by: user.id }).eq('id', sib.id);
        }
      }
    } catch (e) { if ((e as Error)?.message !== 'no-cascade') console.error('[doc-approvals] shared cascade failed:', e); }
  }

  await logAudit({
    actorId:   user.id,
    action:    `approval.${action}`,
    projectId: projectId,
    resource:  `stage ${approval.stage} — ${approval.doc_type ?? ''}`,
    newValue:  { action, stage: approval.stage, notes: notes ?? null },
  });
  return NextResponse.json({ success: true, signatureApplied, nextVersionOpened });
}
