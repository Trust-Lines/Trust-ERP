import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitEvent } from '@/lib/events';
import { resolveLink, requestMeta } from '@/lib/approvals/publicReview';
import { appBaseUrl } from '@/lib/env/appUrl';

type Params = { params: Promise<{ token: string }> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminDb = () => createAdminClient() as any;

export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const admin = adminDb();
  const r = await resolveLink(admin, token);
  if (!r.link) return NextResponse.json({ error: r.error }, { status: r.status });
  const link = r.link;

  const meta = requestMeta(req.headers);
  const patch: Record<string, unknown> = { view_count: (link.view_count as number) + 1 };
  if (!link.first_opened_at) patch.first_opened_at = new Date().toISOString();
  await admin.from('approval_links').update(patch).eq('id', link.id);
  await admin.from('approval_link_events').insert({ approval_link_id: link.id, event_type: 'opened', ip: meta.ip, user_agent: meta.user_agent });

  const { data: project } = await admin.from('projects').select('code, name').eq('id', link.project_id).maybeSingle();

  let document: { file_name: string; doc_type: string; viewUrl: string | null } | null = null;
  if (link.document_id) {
    const { data: doc } = await admin.from('documents')
      .select('id, file_name, doc_type, dropbox_path').eq('id', link.document_id).maybeSingle();
    if (doc && doc.doc_type !== 'pf') {
      let viewUrl: string | null = null;
      try {
        const { getDropboxTemporaryLink } = await import('@/lib/dropbox/upload');
        if (doc.dropbox_path) viewUrl = await getDropboxTemporaryLink(doc.dropbox_path);
      } catch { }
      document = { file_name: doc.file_name, doc_type: doc.doc_type, viewUrl };
    }
  } else if (link.sales_design_version_id) {
    const { data: v } = await admin.from('sales_design_versions')
      .select('version_no, preview_link, notes').eq('id', link.sales_design_version_id).maybeSingle();
    if (v) document = { file_name: `Design — V${v.version_no}${v.notes ? ` · ${v.notes}` : ''}`, doc_type: 'design', viewUrl: v.preview_link ?? null };
  }

  let contactName: string | null = null;
  if (link.customer_contact_id) {
    const { data: c } = await admin.from('customer_contacts').select('name').eq('id', link.customer_contact_id).maybeSingle();
    contactName = (c as { name?: string } | null)?.name ?? null;
  }

  return NextResponse.json({
    title: link.title,
    status: link.status,
    decision: link.decision,
    requireEmailVerification: link.require_email_verification,
    project: project ? { code: project.code, name: project.name } : null,
    document,
    contactName,
  });
}

const ACTIONS: Record<string, { decision?: string; event: string; label: string }> = {
  approve:          { decision: 'approved',            event: 'approved',            label: 'approved' },
  reject:           { decision: 'rejected',            event: 'rejected',            label: 'rejected' },
  request_revision: { decision: 'revision_requested',  event: 'revision_requested',  label: 'requested a revision on' },
  comment:          {                                  event: 'comment',             label: 'commented on' },
};

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const admin = adminDb();
  const r = await resolveLink(admin, token);
  if (!r.link) return NextResponse.json({ error: r.error }, { status: r.status });
  const link = r.link;

  const body = await req.json().catch(() => null) as { action?: string; name?: string; email?: string; comment?: string } | null;
  const action = body?.action ?? '';
  const cfg = ACTIONS[action];
  if (!cfg) return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  if (link.status === 'completed' && cfg.decision) {
    return NextResponse.json({ error: 'A decision has already been recorded for this link.' }, { status: 409 });
  }

  const name = body?.name?.trim();
  const email = body?.email?.trim();
  if (cfg.decision || action === 'comment') {
    if (!name) return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 });
  }
  if (cfg.decision && link.require_email_verification) {
    if (!email) return NextResponse.json({ error: 'Please enter your email to confirm.' }, { status: 400 });
    if (link.customer_contact_id) {
      const { data: c } = await admin.from('customer_contacts').select('email').eq('id', link.customer_contact_id).maybeSingle();
      const expected = (c as { email?: string | null } | null)?.email?.trim().toLowerCase();
      if (expected && expected !== email.toLowerCase()) {
        return NextResponse.json({ error: 'That email does not match the invited contact.' }, { status: 403 });
      }
    }
  }

  const meta = requestMeta(req.headers);
  await admin.from('approval_link_events').insert({
    approval_link_id: link.id, event_type: cfg.event,
    actor_name: name ?? null, actor_email: email ?? null, comment: body?.comment?.trim() || null,
    ip: meta.ip, user_agent: meta.user_agent,
  });

  if (cfg.decision) {
    await admin.from('approval_links').update({
      status: 'completed', decision: cfg.decision, completed_at: new Date().toISOString(),
    }).eq('id', link.id);

    if (link.document_id) {
      await admin.from('documents').update({ status: cfg.decision === 'approved' ? 'approved' : 'rejected' }).eq('id', link.document_id);
    } else if (link.sales_design_version_id) {
      await applyDesignDecision(admin, link.sales_design_version_id as string, cfg.decision, body?.comment?.trim() || null, name ?? 'customer', (link.created_by as string | null) ?? null);
    }
  }

  const { data: recipients } = await admin.from('profiles')
    .select('id, full_name, email').in('role', ['ops_manager', 'general_manager', 'trustlines_pm', 'tlines_pm', 'sales_rep', 'sales_marketing_manager']).eq('is_active', true).limit(50);
  const notifTitle = `Customer ${cfg.label} a review`;
  const bodyText = `${name ?? 'A customer'} ${cfg.label} ${link.title ?? 'a document'}${body?.comment?.trim() ? `: “${body.comment.trim()}”` : ''}.`;
  const appUrl = appBaseUrl();
  for (const rec of (recipients ?? []) as { id: string; full_name: string; email: string }[]) {
    await admin.from('notifications').insert({
      user_id: rec.id, project_id: link.project_id, type: 'approval_link',
      title: notifTitle, body: bodyText, link: `/projects/${link.project_id}`,
    });
    try {
      const { sendEmail } = await import('@/lib/email/send');
      await sendEmail(rec.email, notifTitle, `<p>Hi ${rec.full_name},</p><p>${bodyText}</p><p><a href="${appUrl}/projects/${link.project_id}">Open the project →</a></p>`);
    } catch { }
  }

  if (cfg.decision) {
    await emitEvent(admin, {
      type: 'review.decision',
      entityTable: 'approval_links',
      entityId: link.id as string,
      projectId: link.project_id as string,
      actorId: null,
      payload: {
        decision: cfg.decision,
        title:    link.title ?? null,
        by:       name ?? 'customer',
        comment:  body?.comment?.trim() || null,
      },
    });
  }

  return NextResponse.json({ ok: true, decision: cfg.decision ?? null });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyDesignDecision(admin: any, versionId: string, decision: string, comment: string | null, by: string, actorId: string | null) {
  const verStatus = decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'revision_requested';
  await admin.from('sales_design_versions').update({
    status: verStatus,
    ...(comment ? { customer_feedback: comment } : { customer_feedback: `${by} ${decision.replace(/_/g, ' ')}` }),
  }).eq('id', versionId);

  const { data: ver } = await admin.from('sales_design_versions').select('job_id, version_no').eq('id', versionId).maybeSingle();
  const jobId = (ver as { job_id?: string; version_no?: number } | null)?.job_id;
  if (!jobId) return;

  const jobStatus = decision === 'approved' ? 'approved_by_sales' : 'revision_requested';
  const { data: job } = await admin.from('sales_design_jobs')
    .select('lead_intake_id, opportunity_id, assigned_designer_id').eq('id', jobId).maybeSingle();
  await admin.from('sales_design_jobs').update({ status: jobStatus }).eq('id', jobId);
  const leadId = (job as { lead_intake_id?: string } | null)?.lead_intake_id;
  const opportunityId = (job as { opportunity_id?: string } | null)?.opportunity_id;
  const designerId = (job as { assigned_designer_id?: string } | null)?.assigned_designer_id;

  // 🔴 FIX: a customer's "request revision" decision updated the job's status but never told the
  // designer who actually has to do the rework — they only found out if they happened to be one of
  // the 6 hardcoded internal roles above, which `designer` is not. Notify them directly, with the
  // customer's own comment, on EITHER anchor type.
  if (decision === 'revision_requested' && designerId) {
    try {
      const { notifyUser } = await import('@/lib/sales/notify');
      await notifyUser(admin, {
        userId: designerId, leadId: leadId ?? undefined, opportunityId: opportunityId ?? undefined,
        title: 'Customer requested a revision',
        body: comment ? `${by} requested a revision: "${comment}"` : `${by} requested a revision on your design.`,
      });
    } catch (e) { console.error('[review] designer revision notify failed:', e instanceof Error ? e.message : e); }
  }

  if (decision === 'approved') {
    if (leadId) {
      try {
        const { deliverLeadToTrust } = await import('@/lib/sales/deliver');
        const res = await deliverLeadToTrust(admin, leadId, actorId);

        if (res.ok && res.projectId) {
          const { linkDesignFilesToProject } = await import('@/lib/sales/designDocs');
          await linkDesignFilesToProject(admin, versionId, res.projectId, actorId);
        }
      } catch (e) { console.error('[review] auto-deliver failed:', e instanceof Error ? e.message : e); }
    } else if (opportunityId) {
      // 🔴 FIX: an Opportunity-sourced job already has a real project (created at Accept) — there
      // is no "deliver" step to run, but the approved files were never being linked into the
      // project's documents at all, silently, because this whole branch only checked leadId.
      try {
        const { data: opp } = await admin.from('opportunities').select('project_id').eq('id', opportunityId).maybeSingle();
        const projectId = (opp as { project_id?: string } | null)?.project_id;
        if (projectId) {
          const { linkDesignFilesToProject } = await import('@/lib/sales/designDocs');
          await linkDesignFilesToProject(admin, versionId, projectId, actorId);
        }
      } catch (e) { console.error('[review] opportunity-path file link failed:', e instanceof Error ? e.message : e); }
    }
  }
}
