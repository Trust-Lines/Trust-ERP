import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { DESIGN_MANAGE_ROLES } from '@/lib/sales/design';
import { designRootFromProjectRoot } from '@/lib/dropbox/paths';
import { DesignWorkspaceClient } from '@/components/platform/design/DesignWorkspaceClient';
import type { SalesDesignJob, SalesDesignVersion } from '@/types/database';

export interface LeadBrief {
  id: string;
  customer_name: string | null; brand: string | null;
  city: string | null; street: string | null; state: string | null; address: string | null;
  project_type: string | null;
  matterport_link: string | null;
  scope_of_work: Record<string, boolean> | null;
  notes: Record<string, string> | null;
}
export interface IntakeFile { id: string; lead_intake_id: string; category: string; file_name: string; created_at: string }
export interface DesignFile { id: string; version_id: string; job_id: string; file_name: string; created_at: string }
export interface ProjectMeta { code: string | null; dropboxRoot: string | null; designRoot: string | null; isDraft: boolean }

export default async function DesignWorkspacePage() {
  await requirePage('page.design');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role ?? '';
  const isManager = DESIGN_MANAGE_ROLES.includes(role);

  const JOB_COLS = 'id, lead_intake_id, opportunity_id, customer_id, title, brief, assigned_designer_id, status, priority, due_date, created_at, updated_at';
  let q = admin.from('sales_design_jobs').select(JOB_COLS).is('deleted_at', null);
  if (!isManager) q = q.eq('assigned_designer_id', user.id);
  const jobsRes = await q.order('created_at', { ascending: false }).limit(200);

  const schemaError: string | null = jobsRes.error
    ? `Sales Design tables are not ready (${jobsRes.error.message}). Run migration 051_sales_design.sql.`
    : null;
  if (jobsRes.error) console.error('[design] sales_design_jobs unavailable —', jobsRes.error.message);
  const jobs = (jobsRes.error ? [] : (jobsRes.data ?? [])) as SalesDesignJob[];

  const jobIds = jobs.map(j => j.id);
  let versions: SalesDesignVersion[] = [];
  if (jobIds.length) {
    const vRes = await admin.from('sales_design_versions')
      .select('id, job_id, version_no, status, preview_link, notes, presented_at, customer_feedback, created_at')
      .in('job_id', jobIds).order('version_no', { ascending: false });
    versions = vRes.error ? [] : (vRes.data ?? []);
  }

  const leadIds = [...new Set(jobs.filter(j => j.lead_intake_id).map(j => j.lead_intake_id!))];
  const opportunityIds = [...new Set(jobs.filter(j => j.opportunity_id).map(j => j.opportunity_id!))];

  const leadMap: Record<string, LeadBrief> = {};
  if (leadIds.length) {
    const { data } = await admin.from('lead_intake')
      .select('id, customer_name, brand, city, street, state, address, project_type, matterport_link, scope_of_work, notes')
      .in('id', leadIds);
    for (const row of (data ?? []) as LeadBrief[]) leadMap[row.id] = row;
  }

  if (opportunityIds.length) {
    const { data: opps } = await admin.from('opportunities')
      .select('id, prospect_id, project_types').in('id', opportunityIds);
    const prospectIds = [...new Set(((opps ?? []) as { prospect_id: string }[]).map(o => o.prospect_id))];
    const prospectById: Record<string, { display_name: string; brand_name: string | null }> = {};
    const primaryLocationByProspect: Record<string, { city: string | null; address_line_1: string | null; state: string | null }> = {};
    if (prospectIds.length) {
      const [{ data: prospects }, { data: locations }] = await Promise.all([
        admin.from('prospects').select('id, display_name, brand_name').in('id', prospectIds),
        admin.from('prospect_locations').select('prospect_id, city, address_line_1, state').in('prospect_id', prospectIds),
      ]);
      for (const p of (prospects ?? []) as { id: string; display_name: string; brand_name: string | null }[]) prospectById[p.id] = p;
      for (const l of (locations ?? []) as { prospect_id: string; city: string | null; address_line_1: string | null; state: string | null }[]) {
        if (!primaryLocationByProspect[l.prospect_id]) primaryLocationByProspect[l.prospect_id] = l;
      }
    }
    for (const o of (opps ?? []) as { id: string; prospect_id: string; project_types: string[] }[]) {
      const p = prospectById[o.prospect_id];
      const loc = primaryLocationByProspect[o.prospect_id];
      leadMap[o.id] = {
        id: o.id, customer_name: p?.display_name ?? null, brand: p?.brand_name ?? null,
        city: loc?.city ?? null, street: loc?.address_line_1 ?? null, state: loc?.state ?? null, address: null,
        project_type: o.project_types?.[0] ?? null, matterport_link: null, scope_of_work: null, notes: null,
      };
    }
  }

  const intakeFiles: Record<string, IntakeFile[]> = {};
  if (leadIds.length) {
    const { data } = await admin.from('lead_intake_documents')
      .select('id, lead_intake_id, category, file_name, created_at')
      .in('lead_intake_id', leadIds).order('created_at', { ascending: true });
    for (const f of (data ?? []) as IntakeFile[]) {
      (intakeFiles[f.lead_intake_id] ??= []).push(f);
    }
  }

  const designFiles: Record<string, DesignFile[]> = {};
  if (jobIds.length) {
    const dfRes = await admin.from('sales_design_version_files')
      .select('id, version_id, job_id, file_name, created_at').in('job_id', jobIds).order('created_at', { ascending: true });
    for (const f of ((dfRes.error ? [] : dfRes.data ?? []) as DesignFile[])) {
      (designFiles[f.version_id] ??= []).push(f);
    }
  }

  const projectMeta: Record<string, ProjectMeta> = {};
  {
    const anchorToProjectId: Record<string, string> = {};
    if (leadIds.length) {
      const { data: liRows } = await admin.from('lead_intake').select('id, project_id').in('id', leadIds);
      for (const r of (liRows ?? []) as { id: string; project_id: string | null }[]) {
        if (r.project_id) anchorToProjectId[r.id] = r.project_id;
      }
    }
    if (opportunityIds.length) {
      const { data: oppRows } = await admin.from('opportunities').select('id, project_id').in('id', opportunityIds);
      for (const r of (oppRows ?? []) as { id: string; project_id: string | null }[]) {
        if (r.project_id) anchorToProjectId[r.id] = r.project_id;
      }
    }
    const projIds = [...new Set(Object.values(anchorToProjectId))];
    if (projIds.length) {
      const { data: pRows } = await admin.from('projects').select('id, code, dropbox_root_path, is_draft').in('id', projIds);
      const byId: Record<string, { code: string | null; dropbox_root_path: string | null; is_draft: boolean }> = {};
      for (const p of (pRows ?? []) as { id: string; code: string | null; dropbox_root_path: string | null; is_draft: boolean }[]) byId[p.id] = p;
      for (const [anchor, pid] of Object.entries(anchorToProjectId)) {
        const p = byId[pid];
        if (p) projectMeta[anchor] = {
          code: p.code, dropboxRoot: p.dropbox_root_path,
          designRoot: p.dropbox_root_path ? designRootFromProjectRoot(p.dropbox_root_path) : null,
          isDraft: p.is_draft,
        };
      }
    }
  }

  const designerIds = [...new Set(jobs.map(j => j.assigned_designer_id).filter(Boolean))] as string[];
  const designerMap: Record<string, string> = {};
  if (isManager && designerIds.length) {
    const { data } = await admin.from('profiles').select('id, full_name, office').in('id', designerIds);
    for (const d of (data ?? []) as { id: string; full_name: string; office: string | null }[]) {
      designerMap[d.id] = d.office ? `${d.full_name} — ${d.office}` : d.full_name;
    }
  }

  return (
    <div className="main-inner">
      <DesignWorkspaceClient
        jobs={jobs} versions={versions} leadMap={leadMap} designerMap={designerMap}
        intakeFiles={intakeFiles} designFiles={designFiles} projectMeta={projectMeta}
        isManager={isManager} schemaError={schemaError}
      />
    </div>
  );
}
