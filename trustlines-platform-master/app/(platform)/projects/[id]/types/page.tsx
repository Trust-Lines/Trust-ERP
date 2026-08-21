import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { roleCan } from '@/lib/permissions/server';
import { ProjectTypesClient } from '@/components/platform/projects/ProjectTypesClient';

export default async function ProjectTypesPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('page.production');
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const role = (profile as { role: string } | null)?.role ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const canEdit = await roleCan(admin, role, 'edit.production');

  const { data: project } = await admin.from('projects').select('id, code, name').eq('id', id).maybeSingle();
  if (!project) notFound();

  const rowsRes = await admin.from('production_items')
    .select('id, type, status, assigned_to, priority, start_date, target_date, vendor_id, pf_code, order_type, po_sign_status, pf_sign_status, pf_usd, pf_tl, sort_index')
    .eq('project_id', id).eq('source', 'project').is('deleted_at', null)
    .order('sort_index', { ascending: true });
  const schemaError: string | null = rowsRes.error ? `Type-management columns are not ready (${rowsRes.error.message}). Run migration 062.` : null;
  const rows = rowsRes.error ? [] : (rowsRes.data ?? []);

  const { data: people } = await admin.from('profiles')
    .select('id, full_name, role')
    .in('role', ['ops_manager', 'general_manager', 'trustlines_pm', 'project_manager', 'production_manager', 'pm_millwork', 'pm_ceiling', 'pm_image'])
    .eq('is_active', true).order('full_name', { ascending: true });

  const { data: vendors } = await admin.from('suppliers').select('id, code, name').eq('is_active', true).order('code', { ascending: true });

  let salesFiles: { id: string; file_name: string; dropbox_path: string; created_at: string }[] = [];
  const { data: leadRows } = await admin.from('lead_intake').select('id').eq('project_id', id);
  const leadIds = (leadRows ?? []).map((r: { id: string }) => r.id);
  if (leadIds.length) {
    const { data: jobs } = await admin.from('sales_design_jobs').select('id').in('lead_intake_id', leadIds);
    const jobIds = (jobs ?? []).map((j: { id: string }) => j.id);
    if (jobIds.length) {
      const fr = await admin.from('sales_design_version_files')
        .select('id, file_name, dropbox_path, created_at').in('job_id', jobIds).order('created_at', { ascending: false });
      salesFiles = fr.error ? [] : (fr.data ?? []);
    }
  }

  return (
    <div className="main-inner">
      <ProjectTypesClient
        projectId={id} projectCode={project.code} projectName={project.name} canEdit={canEdit}
        rows={rows} people={people ?? []} vendors={vendors ?? []} salesFiles={salesFiles} schemaError={schemaError}
      />
    </div>
  );
}
