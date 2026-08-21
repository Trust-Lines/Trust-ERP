import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { CONTAINER_WRITE_ROLES } from '@/lib/logistics/containers';
import { LogisticsClient } from '@/components/platform/logistics/LogisticsClient';

export default async function LogisticsPage() {
  await requirePage('page.logistics');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const role = (profile as { role: string } | null)?.role ?? '';
  const canEdit = CONTAINER_WRITE_ROLES.includes(role);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const COLS = 'id, container_no, booking_no, carrier, vessel_name, status, origin_port, destination_port, departure_date, estimated_arrival_date, actual_arrival_date, warehouse_arrival_date, created_at';
  const res = await admin.from('containers').select(COLS).is('deleted_at', null)
    .not('status', 'in', '("COMPLETED","CANCELLED")').order('created_at', { ascending: false }).limit(300);
  const containers = res.error ? [] : (res.data ?? []);

  const ids = containers.map((c: { id: string }) => c.id);
  const counts: Record<string, number> = {};
  if (ids.length) {
    const { data: items } = await admin.from('container_items').select('container_id').in('container_id', ids);
    for (const it of (items ?? []) as { container_id: string }[]) counts[it.container_id] = (counts[it.container_id] ?? 0) + 1;
  }
  const withCounts = containers.map((c: { id: string }) => ({ ...c, item_count: counts[c.id] ?? 0 }));

  return (
    <div className="main-inner">
      <LogisticsClient initialContainers={withCounts} canEdit={canEdit} />
    </div>
  );
}
