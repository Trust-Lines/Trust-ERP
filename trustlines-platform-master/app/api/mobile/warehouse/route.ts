import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { tableMissing } from '@/lib/hr/requests';
import { WAREHOUSE_WRITE_ROLES } from '@/lib/warehouse/roles';

// Mobile Depo home (084): containers arriving / at the warehouse, their items with a location or
// still waiting for put-away (011 / 039), and every located item by shelf.
export async function GET() {
  const { admin, deny } = await requireRole(WAREHOUSE_WRITE_ROLES);
  if (deny) return deny;

  const { data: containers } = await admin.from('containers')
    .select('id, container_no, booking_no, status, estimated_arrival_date, actual_arrival_date, warehouse_arrival_date')
    .is('deleted_at', null).in('status', ['IN_TRANSIT', 'ARRIVED_PORT', 'CUSTOMS', 'RELEASED', 'WAREHOUSE'])
    .order('estimated_arrival_date', { ascending: true }).limit(50);
  const cIds = (containers ?? []).map((c: { id: string }) => c.id);

  const { data: cItems } = cIds.length
    ? await admin.from('container_items').select('container_id, production_item_id, quantity, package_count').in('container_id', cIds).limit(3000)
    : { data: [] };
  const piIds = [...new Set(((cItems ?? []) as { production_item_id: string }[]).map(i => i.production_item_id))];

  const locRes = await admin.from('warehouse_locations').select('production_item_id, location, received_at, updated_at').order('location').limit(3000);
  if (tableMissing(locRes.error, 'warehouse_locations')) return NextResponse.json({ error: 'Warehouse is not set up yet — migration 145 has not been applied.' }, { status: 503 });
  const locs = (locRes.data ?? []) as { production_item_id: string; location: string; received_at: string | null; updated_at: string }[];

  const allIds = [...new Set([...piIds, ...locs.map(l => l.production_item_id)])];
  const { data: pis } = allIds.length
    ? await admin.from('production_items').select('id, project_id, type, status').in('id', allIds)
    : { data: [] };
  const projIds = [...new Set(((pis ?? []) as { project_id: string }[]).map(p => p.project_id))];
  const { data: projs } = projIds.length ? await admin.from('projects').select('id, code').in('id', projIds) : { data: [] };
  const code = Object.fromEntries(((projs ?? []) as { id: string; code: string }[]).map(p => [p.id, p.code]));
  const item = Object.fromEntries(((pis ?? []) as { id: string; project_id: string; type: string; status: string }[])
    .map(p => [p.id, { id: p.id, type: p.type, status: p.status, project_code: code[p.project_id] ?? null }]));
  const locOf = Object.fromEntries(locs.map(l => [l.production_item_id, l]));

  return NextResponse.json({
    containers: (containers ?? []).map((c: { id: string }) => ({
      ...c,
      items: ((cItems ?? []) as { container_id: string; production_item_id: string; quantity: number | null; package_count: number | null }[])
        .filter(i => i.container_id === c.id)
        .map(i => ({ ...item[i.production_item_id], quantity: i.quantity, package_count: i.package_count, location: locOf[i.production_item_id]?.location ?? null })),
    })),
    located: locs.map(l => ({ ...item[l.production_item_id], location: l.location, received_at: l.received_at })).filter(x => x.id),
  });
}
