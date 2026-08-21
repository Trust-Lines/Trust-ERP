import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { logLeadActivity } from './activity';
import { canAccessLead } from './leadAccess';
import { SALES_INTAKE_ROLES } from './roles';

export const DESIGN_MANAGE_ROLES = SALES_INTAKE_ROLES;

export const DESIGNER_ROLES = ['designer'];

export const DESIGNER_INVITE_ROLES = ['ops_manager', 'general_manager', 'sales_marketing_manager'];

export const DESIGN_TRIGGER_STATUS = 'working_on_it_trust';

export const JOB_STATUSES = [
  'awaiting_assignment', 'assigned', 'working_on_it', 'ready_for_sales_review',
  'revision_requested', 'approved_by_sales', 'presented_to_customer', 'completed', 'cancelled',
] as const;

export const VERSION_TO_JOB_STATUS: Record<string, string> = {
  submitted: 'ready_for_sales_review',
  approved: 'approved_by_sales',
  presented: 'presented_to_customer',
  revision_requested: 'revision_requested',
};

export async function requireUserWithRole(): Promise<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { user: { id: string }; role: string; admin: any; deny: null }
  | { user: null; role: null; admin: null; deny: NextResponse }
> {
  const { user, unauth } = await requireUser();
  if (!user) return { user: null, role: null, admin: null, deny: unauth as NextResponse };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).single();
  return { user, role: (data as { role?: string } | null)?.role ?? '', admin, deny: null };
}

export async function loadDesignJobWithAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any, jobId: string, userId: string, role: string,
): Promise<{ job: { id: string; lead_intake_id: string | null; opportunity_id: string | null; assigned_designer_id: string | null; status: string } | null; deny: NextResponse | null }> {
  const { data: job } = await admin.from('sales_design_jobs')
    .select('id, lead_intake_id, opportunity_id, assigned_designer_id, status').eq('id', jobId).is('deleted_at', null).maybeSingle();
  if (!job) return { job: null, deny: NextResponse.json({ error: 'Design job not found' }, { status: 404 }) };

  const isAssignee = job.assigned_designer_id === userId;
  const hasAccess = DESIGN_MANAGE_ROLES.includes(role)
    && (job.lead_intake_id ? await canAccessLead(admin, job.lead_intake_id, userId, role) : true);
  if (!isAssignee && !hasAccess) return { job: null, deny: NextResponse.json({ error: 'Not authorized' }, { status: 403 }) };
  return { job, deny: null };
}

export async function ensureDesignDropboxFolder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any, projectId: string | null,
): Promise<void> {
  if (!projectId) return;
  try {
    const { data: proj } = await admin.from('projects').select('dropbox_root_path').eq('id', projectId).maybeSingle();
    const root = (proj as { dropbox_root_path?: string } | null)?.dropbox_root_path;
    if (!root) return;
    const { createDesignFolders } = await import('@/lib/dropbox/upload');
    await createDesignFolders(root);
  } catch (e) {
    console.error('[design] ensureDesignDropboxFolder failed:', e instanceof Error ? e.message : e);
  }
}

export async function ensureDesignJobForLead(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any, leadId: string, actorId: string,
): Promise<{ created: boolean; jobId: string | null }> {
  try {
    const existing = await admin.from('sales_design_jobs')
      .select('id').eq('lead_intake_id', leadId).is('deleted_at', null).maybeSingle();
    if (existing.error) {
      console.error('[design] ensureDesignJobForLead: sales_design_jobs unavailable —',
        existing.error.message, '· run migration 051_sales_design.sql');
      return { created: false, jobId: null };
    }
    if (existing.data) return { created: false, jobId: existing.data.id };

    const { data: lead } = await admin.from('lead_intake')
      .select('customer_name, brand, customer_id, project_id').eq('id', leadId).maybeSingle();
    const label = (lead?.customer_name?.trim() || lead?.brand?.trim() || 'Lead');
    const title = `Sales Design — ${label}`;

    const { data: job, error } = await admin.from('sales_design_jobs').insert({
      lead_intake_id: leadId,
      customer_id:    lead?.customer_id ?? null,
      title,
      status:         'awaiting_assignment',
      priority:       'normal',
      created_by:     actorId,
    }).select('id').single();

    if (error) {
      if (error.code !== '23505') {
        console.error('[design] ensureDesignJobForLead: insert failed —', error.message);
      }
      return { created: false, jobId: null };
    }

    await logAudit({ actorId, action: 'design_job.auto_created', resource: `sales_design_job:${job.id}`, newValue: { lead: leadId, trigger: DESIGN_TRIGGER_STATUS } });
    await logLeadActivity(admin, { leadIntakeId: leadId, actorId, kind: 'change', body: 'design job created — awaiting designer assignment' });

    await ensureDesignDropboxFolder(admin, lead?.project_id ?? null);

    return { created: true, jobId: job.id };
  } catch (e) {
    console.error('[design] ensureDesignJobForLead failed:', e instanceof Error ? e.message : e);
    return { created: false, jobId: null };
  }
}
