import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { CONTAINER_READ_ROLES, CONTAINER_WRITE_ROLES, CONTAINER_STATUSES } from '@/lib/logistics/containers';

const COLS = 'id, container_no, booking_no, carrier, vessel_name, voyage_no, origin_port, destination_port, departure_date, estimated_arrival_date, actual_arrival_date, customs_clearance_date, warehouse_arrival_date, status, seal_no, tracking_url, notes, created_at, updated_at';

export async function GET(req: NextRequest) {
  const { admin, deny } = await requireRole(CONTAINER_READ_ROLES);
  if (deny) return deny;

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? '';
  const includeCompleted = url.searchParams.get('includeCompleted') === '1';

  let q = admin.from('containers').select(COLS).is('deleted_at', null);
  if (status) q = q.eq('status', status);
  else if (!includeCompleted) q = q.not('status', 'in', '("COMPLETED","CANCELLED")');
  const res = await q.order('created_at', { ascending: false }).limit(300);
  if (res.error) return NextResponse.json({ containers: [] });

  const ids = (res.data ?? []).map((c: { id: string }) => c.id);
  const counts: Record<string, number> = {};
  if (ids.length) {
    const { data: items } = await admin.from('container_items').select('container_id').in('container_id', ids);
    for (const it of (items ?? []) as { container_id: string }[]) counts[it.container_id] = (counts[it.container_id] ?? 0) + 1;
  }
  const containers = (res.data ?? []).map((c: { id: string }) => ({ ...c, item_count: counts[c.id] ?? 0 }));
  return NextResponse.json({ containers });
}

export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireRole(CONTAINER_WRITE_ROLES);
  if (deny) return deny;

  const b = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string).trim() || null : null);

  const status = CONTAINER_STATUSES.includes(String(b.status) as never) ? String(b.status) : 'PLANNING';
  const { data, error } = await admin.from('containers').insert({
    container_no: str('container_no'), booking_no: str('booking_no'), carrier: str('carrier'),
    vessel_name: str('vessel_name'), voyage_no: str('voyage_no'),
    origin_port: str('origin_port'), destination_port: str('destination_port'),
    departure_date: str('departure_date'), estimated_arrival_date: str('estimated_arrival_date'),
    seal_no: str('seal_no'), tracking_url: str('tracking_url'), notes: str('notes'),
    status, created_by: user.id,
  }).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'container.created', resource: `container:${data.id}`, newValue: { container_no: data.container_no } });
  return NextResponse.json({ container: { ...data, item_count: 0 } }, { status: 201 });
}
