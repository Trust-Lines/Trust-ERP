import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { sendEmail, approvalRejectedHtml } from '@/lib/email/send';
import { appBaseUrl } from '@/lib/env/appUrl';

type Params = { params: Promise<{ id: string; docId: string }> };

const DOC_TYPE_STEP: Record<string, { phase: string; step_key: string }> = {
  plan_layout:           { phase: 'phase1', step_key: 'plan_layout' },
  proposal:              { phase: 'phase1', step_key: 'design_proposal' },
  construction_drawings: { phase: 'phase2', step_key: 'construction_drawings' },
};

export async function POST(req: NextRequest, { params }: Params) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  const { id: projectId, docId } = await params;
  const body = await req.json() as { stage?: 1 | 2; reset?: boolean; reject?: boolean; notes?: string };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  if (body.reset) {
    const { data: p } = await admin
      .from('projects').select('trustlines_pm_id').eq('id', projectId).single() as
      { data: { trustlines_pm_id: string | null } | null };
    if (p?.trustlines_pm_id !== user.id) {
      return NextResponse.json({ error: 'Only Trust PM can reset approval' }, { status: 403 });
    }
    await admin.from('documents')
      .update({ status: 'draft', approved_at: null, approved_by: null })
      .eq('id', docId).eq('project_id', projectId);
    await logAudit({ actorId: user.id, action: 'document.approval_reset', projectId, resource: docId });
    return NextResponse.json({ success: true, newStatus: 'draft' });
  }

  const { data: project } = await admin
    .from('projects').select('trustlines_pm_id, tlines_pm_id').eq('id', projectId).single() as
    { data: { trustlines_pm_id: string | null; tlines_pm_id: string | null } | null };

  const isTrustPm  = project?.trustlines_pm_id === user.id;
  const isClientPm = project?.tlines_pm_id      === user.id;

  const stage = body.stage ?? 1;

  if (body.reject) {
    if (stage === 1 && !isTrustPm)  return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    if (stage === 2 && !isClientPm) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const now2 = new Date().toISOString();
    await admin.from('documents').update({ status: 'rejected' }).eq('id', docId).eq('project_id', projectId);

    const { data: rejectorProfile } = await admin.from('profiles').select('full_name').eq('id', user.id).single() as
      { data: { full_name?: string } | null };
    const rejectorName = rejectorProfile?.full_name ?? 'Unknown';
    const stepNote = body.notes ? `Rejected by ${rejectorName}: ${body.notes}` : `Rejected by ${rejectorName}`;

    const { data: docRowR } = await admin.from('documents').select('doc_type, dropbox_version, version')
      .eq('id', docId).single() as { data: { doc_type: string; dropbox_version: number | null; version: number } | null };

    const { data: existingStageRec } = await admin.from('document_approvals').select('id')
      .eq('document_id', docId).eq('project_id', projectId).eq('stage', stage).maybeSingle();
    if (existingStageRec) {
      await admin.from('document_approvals').update({
        status: 'rejected', resolved_at: now2, notes: body.notes ?? null, approved_by: user.id,
      }).eq('id', existingStageRec.id);
    } else {
      if (stage === 2) {
        const { data: s1Exists } = await admin.from('document_approvals').select('id')
          .eq('document_id', docId).eq('project_id', projectId).eq('stage', 1).maybeSingle();
        if (!s1Exists) {
          await admin.from('document_approvals').insert({
            document_id: docId, project_id: projectId, requested_by: user.id,
            assigned_to: project?.trustlines_pm_id ?? null,
            status: 'approved', approved_by: user.id, resolved_at: now2,
            stage: 1, doc_type: docRowR?.doc_type ?? null,
          });
        }
      }
      await admin.from('document_approvals').insert({
        document_id: docId, project_id: projectId, requested_by: user.id,
        assigned_to: user.id, status: 'rejected', approved_by: user.id,
        resolved_at: now2, notes: body.notes ?? null, stage,
        doc_type: docRowR?.doc_type ?? null,
      });
    }

    const stepInfoR = docRowR?.doc_type ? DOC_TYPE_STEP[docRowR.doc_type] : null;
    if (stepInfoR) {
      const { data: existStep } = await admin.from('project_steps').select('id')
        .eq('project_id', projectId).eq('phase', stepInfoR.phase)
        .eq('step_key', stepInfoR.step_key).is('cat_group', null).maybeSingle();
      if (existStep) {
        await admin.from('project_steps').update({ status: 'rejected', notes: stepNote }).eq('id', existStep.id);
      }
    }

    if (stage === 2 && project?.trustlines_pm_id) {
      const appUrl = appBaseUrl();
      const docLabel = docRowR?.doc_type === 'plan_layout' ? 'Item Plan' : 'Design Proposal';
      const versionLabel = `V${(docRowR?.dropbox_version ?? docRowR?.version ?? 0)}`;
      const tabSlug = docRowR?.doc_type === 'plan_layout' ? 'plan_layout' : 'design_proposal';
      const { data: notifyProfile } = await admin.from('profiles').select('email, full_name')
        .eq('id', project.trustlines_pm_id).single() as { data: { email?: string; full_name?: string } | null };
      if (notifyProfile?.email) {
        try {
          await sendEmail(
            notifyProfile.email,
            `[Trust-Lines] Rejected: ${docLabel} ${versionLabel} — (project ${projectId})`,
            approvalRejectedHtml({
              rejectorName:  rejectorName,
              recipientName: notifyProfile.full_name ?? 'Trust PM',
              projectName:   projectId,
              projectCode:   '',
              docLabel, versionLabel,
              actionUrl: `${appUrl}/projects/${projectId}?tab=${tabSlug}`,
              notes: body.notes ?? undefined,
            }),
          );
        } catch (e) { console.error('[email] reject email failed:', e); }
      }
    }

    await logAudit({ actorId: user.id, action: 'document.rejected', projectId, resource: docId });
    return NextResponse.json({ success: true, newStatus: 'rejected' });
  }

  if (stage === 1 && !isTrustPm)  return NextResponse.json({ error: 'Not authorized for Stage 1' }, { status: 403 });
  if (stage === 2 && !isClientPm) return NextResponse.json({ error: 'Not authorized for Stage 2' }, { status: 403 });

  const { data: docCheck } = await admin.from('documents').select('status').eq('id', docId).single() as
    { data: { status: string } | null };
  if (docCheck?.status === 'rejected') {
    return NextResponse.json({ error: 'This version has been rejected. Please upload a new version to restart the approval.' }, { status: 409 });
  }

  if (stage === 2) {
    const { data: doc } = await admin
      .from('documents').select('status').eq('id', docId).single() as { data: { status: string } | null };
    if (doc?.status !== 'pending_approval') {
      return NextResponse.json({ error: 'Stage 1 must be approved first' }, { status: 409 });
    }
  }

  const newStatus = stage === 1 ? 'pending_approval' : 'approved';
  const now = new Date().toISOString();

  const update: Record<string, unknown> = { status: newStatus };
  if (stage === 2) { update.approved_at = now; update.approved_by = user.id; }

  const { error } = await admin.from('documents').update(update).eq('id', docId).eq('project_id', projectId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (stage === 1) {
    const { data: s1 } = await admin.from('document_approvals').select('id')
      .eq('document_id', docId).eq('project_id', projectId).eq('stage', 1).maybeSingle();
    if (s1) {
      await admin.from('document_approvals')
        .update({ status: 'approved', approved_by: user.id, resolved_at: now }).eq('id', s1.id);
      await admin.from('document_approvals').update({ status: 'pending' })
        .eq('document_id', docId).eq('project_id', projectId).eq('stage', 2);
    }
  } else if (stage === 2) {
    const { data: s2 } = await admin.from('document_approvals').select('id')
      .eq('document_id', docId).eq('project_id', projectId).eq('stage', 2).maybeSingle();
    if (s2) {
      await admin.from('document_approvals')
        .update({ status: 'approved', approved_by: user.id, resolved_at: now }).eq('id', s2.id);
    }
  }

  await logAudit({
    actorId: user.id, action: stage === 1 ? 'document.stage1_approved' : 'document.approved',
    projectId, resource: docId,
  });

  const { data: docRow } = await admin
    .from('documents').select('doc_type, dropbox_version, version').eq('id', docId).single() as
    { data: { doc_type: string; dropbox_version: number | null; version: number } | null };
  const stepInfo = docRow?.doc_type ? DOC_TYPE_STEP[docRow.doc_type] : null;

  if (stepInfo && docRow?.doc_type) {
    async function upsertStep(status: string, extra: Record<string, unknown> = {}) {
      const { data: existing } = await admin.from('project_steps').select('id')
        .eq('project_id', projectId).eq('phase', stepInfo!.phase)
        .eq('step_key', stepInfo!.step_key).is('cat_group', null).maybeSingle();
      if (existing) {
        await admin.from('project_steps').update({ status, ...extra }).eq('id', existing.id);
      } else {
        await admin.from('project_steps').insert({
          project_id: projectId, phase: stepInfo!.phase, step_key: stepInfo!.step_key,
          cat_group: null, status, completed_at: now, completed_by: user!.id, ...extra,
        });
      }
    }

    const currentVer = docRow.dropbox_version ?? docRow.version ?? 0;
    let verQuery = admin.from('documents').select('status')
      .eq('project_id', projectId).eq('doc_type', docRow.doc_type);
    if (docRow.dropbox_version != null) {
      verQuery = verQuery.eq('dropbox_version', currentVer);
    } else {
      verQuery = verQuery.eq('version', currentVer);
    }
    const { data: versionDocs } = await verQuery as { data: { status: string }[] | null };

    if (stage === 1) {
      const allStage1Done = versionDocs && versionDocs.length > 0 &&
        versionDocs.every(d => ['pending_approval', 'approved'].includes(d.status));
      if (allStage1Done) {
        await upsertStep('done', {
          notes: 'T-Lines PM approval pending',
          approved_by: null, approved_at: null, version_approved: null,
        });
      }
    }

    if (stage === 2) {
      const allApproved = versionDocs && versionDocs.length > 0 &&
        versionDocs.every(d => d.status === 'approved');
      if (allApproved) {
        await upsertStep('approved', {
          approved_by: user.id, approved_at: now,
          version_approved: currentVer || null, notes: null,
        });
      }
    }
  }

  return NextResponse.json({ success: true, newStatus });
}
