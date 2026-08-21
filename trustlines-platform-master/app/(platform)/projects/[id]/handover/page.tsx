import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { HandoverClient } from '@/components/platform/projects/HandoverClient';
import { defaultChecklist, deriveHandover, AUTO_HANDOVER_KEYS, HANDOVER_READ_ROLES, HANDOVER_WRITE_ROLES } from '@/lib/handover/checklist';

export default async function ProjectHandoverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role ?? '';
  if (!HANDOVER_READ_ROLES.includes(role)) redirect('/projects');
  const canEdit = HANDOVER_WRITE_ROLES.includes(role);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: project } = await admin.from('projects')
    .select('id, code, name, dropbox_root_path, customer_id, closed_deal_date, deal_value, currency, scope_summary, current_stage, tlines_pm_id, trustlines_pm_id, ops_manager_id, pm_supervisor_id')
    .eq('id', id).maybeSingle();
  if (!project) notFound();
  if (role === 'tlines_pm' && project.tlines_pm_id !== user.id) redirect('/projects');

  const ids = [project.tlines_pm_id, project.trustlines_pm_id, project.ops_manager_id, project.pm_supervisor_id].filter(Boolean);
  const { data: profs } = ids.length
    ? await admin.from('profiles').select('id, full_name').in('id', ids)
    : { data: [] };
  const nameOf = (pid: string | null) => (profs ?? []).find((p: { id: string }) => p.id === pid)?.full_name ?? null;

  const hRes = await admin.from('project_handovers')
    .select('id, project_id, checklist, status, meeting_at, notes, handed_over_by, handover_at, created_at, updated_at')
    .eq('project_id', id).maybeSingle();
  const handover = hRes.error ? null : (hRes.data ?? null);

  let customer: { id: string; name: string } | null = null;
  let attached: { id: string; customer_contact_id: string; role_on_project: string | null; is_primary: boolean }[] = [];
  let contactMap: Record<string, { id: string; name: string; title: string | null; email: string | null; phone: string | null }> = {};
  let available: { id: string; name: string; title: string | null }[] = [];
  if (project.customer_id) {
    const cRes = await admin.from('customers').select('id, name').eq('id', project.customer_id).is('deleted_at', null).maybeSingle();
    customer = cRes.error ? null : (cRes.data ?? null);
    const lRes = await admin.from('project_customer_contacts').select('id, customer_contact_id, role_on_project, is_primary').eq('project_id', id);
    attached = lRes.error ? [] : (lRes.data ?? []);
    const allRes = await admin.from('customer_contacts').select('id, name, title, email, phone').eq('customer_id', project.customer_id).is('deleted_at', null).order('name');
    const all = allRes.error ? [] : (allRes.data ?? []);
    contactMap = Object.fromEntries(all.map((c: { id: string }) => [c.id, c]));
    const attachedIds = new Set(attached.map(a => a.customer_contact_id));
    available = all.filter((c: { id: string }) => !attachedIds.has(c.id)).map((c: { id: string; name: string; title: string | null }) => ({ id: c.id, name: c.name, title: c.title }));
  }

  const summary = {
    tlines_pm: nameOf(project.tlines_pm_id),
    trustlines_pm: nameOf(project.trustlines_pm_id),
    ops_manager: nameOf(project.ops_manager_id),
    pm_supervisor: nameOf(project.pm_supervisor_id),
    dropbox_root_path: project.dropbox_root_path ?? null,
    closed_deal_date: project.closed_deal_date ?? null,
    deal_value: project.deal_value ?? null,
    currency: project.currency ?? null,
    scope_summary: project.scope_summary ?? null,
  };

  const { count: documentCount } = await admin.from('documents')
    .select('id', { count: 'exact', head: true }).eq('project_id', id);
  let meetingAt: string | null = (handover as { meeting_at?: string | null } | null)?.meeting_at ?? null;
  if (!meetingAt && project.customer_id) {
    const mRes = await admin.from('customer_meetings')
      .select('meeting_at').eq('customer_id', project.customer_id).eq('meeting_type', 'handover')
      .is('deleted_at', null).order('meeting_at', { ascending: false }).limit(1).maybeSingle();
    meetingAt = mRes.error ? null : ((mRes.data as { meeting_at?: string } | null)?.meeting_at ?? null);
  }
  const derived = deriveHandover({
    tlines_pm_id:     project.tlines_pm_id ?? null,
    trustlines_pm_id: project.trustlines_pm_id ?? null,
    pm_supervisor_id: project.pm_supervisor_id ?? null,
    dropbox_root_path: project.dropbox_root_path ?? null,
    customer_id:      project.customer_id ?? null,
    closed_deal_date: project.closed_deal_date ?? null,
    documentCount:    documentCount ?? 0,
    meetingAt,
  });

  return (
    <div className="main-inner">
      <HandoverClient
        projectId={id}
        projectCode={project.code}
        projectName={project.name}
        canEdit={canEdit}
        summary={summary}
        initialHandover={handover}
        template={defaultChecklist()}
        derived={derived}
        autoKeys={[...AUTO_HANDOVER_KEYS]}
        customer={customer}
        initialAttached={attached}
        contactMap={contactMap}
        initialAvailable={available}
      />
    </div>
  );
}
