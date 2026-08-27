import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { IntakeForm } from '@/components/platform/leads/IntakeForm';
import { CustomerLinkCard } from '@/components/platform/leads/CustomerLinkCard';
import { SalesDesignCard } from '@/components/platform/leads/SalesDesignCard';
import { LeadActivity } from '@/components/platform/leads/LeadActivity';
import { LeadTracking } from '@/components/platform/leads/LeadTracking';
import { WatchButton } from '@/components/platform/leads/WatchButton';
import { SALES_INTAKE_ROLES } from '@/lib/sales/roles';
import { canAccessLead } from '@/lib/sales/leadAccess';
import { DESIGNER_ROLES, DESIGNER_INVITE_ROLES, DESIGN_TRIGGER_STATUS, ensureDesignJobForLead } from '@/lib/sales/design';
import type { SalesDesignVersion } from '@/types/database';

export default async function LeadIntakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role ?? '';
  if (!SALES_INTAKE_ROLES.includes(role)) redirect('/dashboard');


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const [intakeRes, assigneesRes] = await Promise.all([
    admin.from('lead_intake').select('id, customer_name, brand, opportunity_status').eq('id', id).maybeSingle(),
    admin.from('profiles').select('id, full_name')
      .in('role', ['sales_rep', 'sales_marketing_manager']).eq('is_active', true).order('full_name'),
  ]);
  const intake = intakeRes.data;
  const assignees = (assigneesRes.data ?? []) as { id: string; full_name: string }[];




  if (!(await canAccessLead(admin, id, user.id, role))) redirect('/leads');







  if (!intake) {
    return <IntakeForm intakeId={id} assignees={assignees} />;
  }

  const it = intake as { customer_name?: string; brand?: string };
  const title = it.customer_name?.trim() || it.brand?.trim() || 'New lead';


  let linkedCustomer: { id: string; name: string } | null = null;
  const linkRes = await admin.from('lead_intake').select('customer_id, is_delivered').eq('id', id).maybeSingle();
  const custId = linkRes.error ? null : (linkRes.data as { customer_id?: string | null } | null)?.customer_id;
  const isDelivered = linkRes.error ? false : !!(linkRes.data as { is_delivered?: boolean } | null)?.is_delivered;
  if (custId) {
    const { data: c } = await admin.from('customers').select('id, name').eq('id', custId).is('deleted_at', null).maybeSingle();
    linkedCustomer = (c as { id: string; name: string } | null) ?? null;
  }



  const JOB_COLS = 'id, lead_intake_id, customer_id, title, brief, assigned_designer_id, status, priority, due_date, created_at, updated_at';
  const fetchJobs = () => admin.from('sales_design_jobs').select(JOB_COLS)
    .eq('lead_intake_id', id).is('deleted_at', null).order('created_at', { ascending: false });

  let jobsRes = await fetchJobs();

  const designSchemaError: string | null = jobsRes.error
    ? `Sales Design tables are not ready (${jobsRes.error.message}). Run migration 051_sales_design.sql.`
    : null;
  if (jobsRes.error) console.error('[leads/[id]] sales_design_jobs unavailable —', jobsRes.error.message);

  let designJobs = jobsRes.error ? [] : (jobsRes.data ?? []);




  const leadStatus = (intake as { opportunity_status?: string }).opportunity_status;
  if (!designSchemaError && designJobs.length === 0 && leadStatus === DESIGN_TRIGGER_STATUS) {
    const { created } = await ensureDesignJobForLead(admin, id, user.id);
    if (created) {
      jobsRes = await fetchJobs();
      designJobs = jobsRes.error ? [] : (jobsRes.data ?? []);
    }
  }

  const jobIds = designJobs.map((j: { id: string }) => j.id);
  let designVersions: SalesDesignVersion[] = [];
  const designFiles: Record<string, { id: string; version_id: string; file_name: string }[]> = {};
  if (jobIds.length) {
    const vRes = await admin.from('sales_design_versions')
      .select('id, job_id, version_no, status, preview_link, notes, presented_at, customer_feedback, created_at')
      .in('job_id', jobIds).order('version_no', { ascending: false });
    designVersions = vRes.error ? [] : (vRes.data ?? []);


    const dfRes = await admin.from('sales_design_version_files')
      .select('id, version_id, file_name').in('job_id', jobIds).order('created_at', { ascending: true });
    for (const f of ((dfRes.error ? [] : dfRes.data ?? []) as { id: string; version_id: string; file_name: string }[])) {
      (designFiles[f.version_id] ??= []).push(f);
    }
  }



  const designersRes = await admin.from('profiles')
    .select('id, full_name, office').in('role', DESIGNER_ROLES).eq('is_active', true).order('full_name').limit(200);
  const designers = (designersRes.error ? [] : (designersRes.data ?? [])) as { id: string; full_name: string; office: string | null }[];

  return (
    <div className="main-inner">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <Link href="/leads" className="btn btn-ghost btn-sm" style={{ color: 'var(--fg-subtle)' }}>← Leads</Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: 0 }}>{title}</h1>
          <p className="page-head-sub" style={{ margin: '2px 0 0' }}>Meeting / Intake form</p>
        </div>
        <WatchButton intakeId={id} />
      </div>

      <CustomerLinkCard intakeId={id} initialCustomer={linkedCustomer} delivered={isDelivered} />
      <SalesDesignCard
        initialJobs={designJobs}
        initialVersions={designVersions}
        designers={designers}
        canManage
        canInviteDesigner={DESIGNER_INVITE_ROLES.includes(role)}
        schemaError={designSchemaError}
        leadStatus={leadStatus ?? null}
        designFiles={designFiles}
      />
      <IntakeForm intakeId={id} assignees={assignees} />
      <LeadTracking intakeId={id} />
      <LeadActivity intakeId={id} />
    </div>
  );
}
