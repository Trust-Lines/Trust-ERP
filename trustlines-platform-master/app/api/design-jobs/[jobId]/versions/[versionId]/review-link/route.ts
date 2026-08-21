import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { requireUserWithRole, loadDesignJobWithAccess, DESIGN_MANAGE_ROLES } from '@/lib/sales/design';
import { generateReviewToken, hashReviewToken } from '@/lib/approvals/reviewToken';
import { syncOpportunityStageFromDesignJob } from '@/lib/marketing/design';

type Params = { params: Promise<{ jobId: string; versionId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { jobId, versionId } = await params;
  const { user, role, admin, deny } = await requireUserWithRole();
  if (deny) return deny;
  const { job, deny: accessDeny } = await loadDesignJobWithAccess(admin, jobId, user.id, role);
  if (accessDeny) return accessDeny;
  if (!DESIGN_MANAGE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Only Sales / Ops may send a design to the customer' }, { status: 403 });
  }

  const { data: version } = await admin.from('sales_design_versions')
    .select('id, version_no').eq('id', versionId).eq('job_id', jobId).maybeSingle();
  if (!version) return NextResponse.json({ error: 'Version not found' }, { status: 404 });

  let projectId: string | null = null;
  let customerId: string | null = null;
  if (job!.lead_intake_id) {
    const { data: lead } = await admin.from('lead_intake').select('project_id, customer_id').eq('id', job!.lead_intake_id).maybeSingle();
    projectId = (lead as { project_id?: string | null } | null)?.project_id ?? null;
    customerId = (lead as { customer_id?: string | null } | null)?.customer_id ?? null;
  } else if (job!.opportunity_id) {
    const { data: opp } = await admin.from('opportunities').select('project_id, customer_id').eq('id', job!.opportunity_id).maybeSingle();
    projectId = (opp as { project_id?: string | null } | null)?.project_id ?? null;
    customerId = (opp as { customer_id?: string | null } | null)?.customer_id ?? null;
  }
  if (!projectId) return NextResponse.json({ error: 'This design job has no project yet.' }, { status: 409 });

  const b = await req.json().catch(() => ({})) as { customerContactId?: string | null; expiresInDays?: number | null; requireEmailVerification?: boolean };

  let contactId = b?.customerContactId ?? null;
  if (!contactId && customerId) {
    const { data: c } = await admin.from('customer_contacts')
      .select('id').eq('customer_id', customerId).is('deleted_at', null)
      .order('is_primary', { ascending: false }).limit(1).maybeSingle();
    contactId = (c as { id?: string } | null)?.id ?? null;
  }

  const token = generateReviewToken();
  const expiresAt = b?.expiresInDays && b.expiresInDays > 0 ? new Date(Date.now() + b.expiresInDays * 86400_000).toISOString() : null;

  const { data, error } = await admin.from('approval_links').insert({
    project_id: projectId,
    sales_design_version_id: versionId,
    customer_contact_id: contactId,
    title: `Design — V${version.version_no}`,
    token_hash: hashReviewToken(token),
    status: 'active',
    expires_at: expiresAt,
    require_email_verification: b?.requireEmailVerification !== false,
    created_by: user.id,
  }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from('sales_design_versions').update({ status: 'presented', presented_at: new Date().toISOString() }).eq('id', versionId);
  await admin.from('sales_design_jobs').update({ status: 'presented_to_customer' }).eq('id', jobId);

  if (job!.opportunity_id) {
    await syncOpportunityStageFromDesignJob(admin, job!, 'discovery', 'proposal');
    await syncOpportunityStageFromDesignJob(admin, job!, 'sales_design', 'proposal');
  }

  await logAudit({ actorId: user.id, action: 'design_review_link.created', projectId, resource: `approval_link:${data.id}`, newValue: { versionId } });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return NextResponse.json({ id: data.id, url: `${appUrl}/review/${token}`, token }, { status: 201 });
}
