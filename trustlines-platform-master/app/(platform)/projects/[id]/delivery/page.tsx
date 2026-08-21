import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DeliveryClient } from '@/components/platform/projects/DeliveryClient';
import { DELIVERY_READ_ROLES, DELIVERY_WRITE_ROLES } from '@/lib/delivery/config';

export default async function ProjectDeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role ?? '';
  if (!DELIVERY_READ_ROLES.includes(role)) redirect('/projects');
  const canEdit = DELIVERY_WRITE_ROLES.includes(role);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: project } = await admin.from('projects').select('id, code, name, tlines_pm_id').eq('id', id).maybeSingle();
  if (!project) notFound();
  if (role === 'tlines_pm' && project.tlines_pm_id !== user.id) redirect('/projects');

  const dpRes = await admin.from('delivery_plans')
    .select('id, project_id, delivery_method, installation_date, build_by, build_schedule, site_confirmed, customer_accepted, accepted_by, accepted_at, status, notes')
    .eq('project_id', id).maybeSingle();
  const deliveryPlan = dpRes.error ? null : (dpRes.data ?? null);
  const schemaError: string | null = dpRes.error ? `Delivery tables are not ready (${dpRes.error.message}). Run migration 059_delivery_build.sql.` : null;

  const plRes = await admin.from('punch_list_items')
    .select('id, title, description, status, resolved_at, created_at')
    .eq('project_id', id).is('deleted_at', null).order('created_at', { ascending: false });
  const punchList = plRes.error ? [] : (plRes.data ?? []);

  const srRes = await admin.from('site_readiness').select('overall_status, target_ready_date').eq('project_id', id).maybeSingle();
  const siteReadiness = srRes.error ? null : (srRes.data ?? null);

  let containers: { id: string; container_no: string | null; status: string; estimated_arrival_date: string | null }[] = [];
  const itemsRes = await admin.from('production_items')
    .select('id').eq('project_id', id).is('deleted_at', null).limit(200);
  const itemIds = (itemsRes.data ?? []).map((i: { id: string }) => i.id);
  if (itemIds.length) {
    const ciRes = await admin.from('container_items').select('container_id').in('production_item_id', itemIds).limit(200);
    const containerIds = [...new Set((ciRes.data ?? []).map((c: { container_id: string }) => c.container_id))];
    if (containerIds.length) {
      const cRes = await admin.from('containers')
        .select('id, container_no, status, estimated_arrival_date')
        .in('id', containerIds).is('deleted_at', null).limit(50);
      containers = cRes.error ? [] : (cRes.data ?? []);
    }
  }

  return (
    <div className="main-inner">
      <DeliveryClient
        projectId={id} projectCode={project.code} projectName={project.name} canEdit={canEdit}
        initialPlan={deliveryPlan} initialPunchList={punchList} schemaError={schemaError}
        siteReadiness={siteReadiness} containers={containers}
      />
    </div>
  );
}
