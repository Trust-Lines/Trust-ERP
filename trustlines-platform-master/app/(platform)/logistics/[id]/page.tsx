import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { CONTAINER_WRITE_ROLES } from '@/lib/logistics/containers';
import { ContainerDetailClient } from '@/components/platform/logistics/ContainerDetailClient';

export default async function ContainerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('page.logistics');
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const role = (profile as { role: string } | null)?.role ?? '';
  const canEdit = CONTAINER_WRITE_ROLES.includes(role);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: container } = await admin.from('containers')
    .select('id, container_no, booking_no, carrier, vessel_name, voyage_no, origin_port, destination_port, departure_date, estimated_arrival_date, actual_arrival_date, customs_clearance_date, warehouse_arrival_date, status, seal_no, tracking_url, notes, delivery_destination, job_site_address')
    .eq('id', id).is('deleted_at', null).maybeSingle();
  if (!container) notFound();

  const docsRes = await admin.from('container_documents')
    .select('id, container_id, doc_type, name, dropbox_path, url, created_at')
    .eq('container_id', id).is('deleted_at', null).order('created_at', { ascending: false });
  const documents = docsRes.error ? [] : (docsRes.data ?? []);

  const { data: rawItems } = await admin.from('container_items')
    .select('id, production_item_id, quantity, package_count, pallet_count, gross_weight, volume_cbm, notes')
    .eq('container_id', id).order('created_at');

  const piIds = (rawItems ?? []).map((i: { production_item_id: string }) => i.production_item_id);
  const piMap: Record<string, { pf_code: string | null; type: string; project_code: string | null }> = {};
  if (piIds.length) {
    const { data: pis } = await admin.from('production_items').select('id, pf_code, type, project_id').in('id', piIds);
    const projIds = [...new Set((pis ?? []).map((p: { project_id: string }) => p.project_id))];
    const projCode: Record<string, string> = {};
    if (projIds.length) {
      const { data: projs } = await admin.from('projects').select('id, code').in('id', projIds);
      for (const p of (projs ?? []) as { id: string; code: string }[]) projCode[p.id] = p.code;
    }
    for (const p of (pis ?? []) as { id: string; pf_code: string | null; type: string; project_id: string }[]) {
      piMap[p.id] = { pf_code: p.pf_code, type: p.type, project_code: projCode[p.project_id] ?? null };
    }
  }
  const items = (rawItems ?? []).map((i: { production_item_id: string }) => ({ ...i, production_item: piMap[i.production_item_id] ?? null }));

  return (
    <div className="main-inner">
      <ContainerDetailClient initialContainer={container} initialItems={items} initialDocuments={documents} canEdit={canEdit} />
    </div>
  );
}
