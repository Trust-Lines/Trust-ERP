import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { emitEvent } from '@/lib/events';
import { maybeEmitItemsReady } from '@/lib/events/triggers';
import { CONTAINER_READ_ROLES, CONTAINER_WRITE_ROLES, CONTAINER_STATUSES, CONTAINER_IN_TRANSIT, CONTAINER_ARRIVAL_STATUSES } from '@/lib/logistics/containers';

type Params = { params: Promise<{ id: string }> };
const COLS = 'id, container_no, booking_no, carrier, vessel_name, voyage_no, origin_port, destination_port, departure_date, estimated_arrival_date, actual_arrival_date, customs_clearance_date, warehouse_arrival_date, status, seal_no, tracking_url, notes, delivery_destination, job_site_address, created_at, updated_at';
const EDITABLE = ['container_no', 'booking_no', 'carrier', 'vessel_name', 'voyage_no', 'origin_port', 'destination_port', 'departure_date', 'estimated_arrival_date', 'actual_arrival_date', 'customs_clearance_date', 'warehouse_arrival_date', 'status', 'seal_no', 'tracking_url', 'notes', 'delivery_destination', 'job_site_address'] as const;

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { admin, deny } = await requireRole(CONTAINER_READ_ROLES);
  if (deny) return deny;

  const { data: container, error } = await admin.from('containers').select(COLS).eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!container) return NextResponse.json({ error: 'Container not found' }, { status: 404 });

  const { data: items } = await admin.from('container_items')
    .select('id, production_item_id, quantity, package_count, pallet_count, gross_weight, volume_cbm, loaded_at, unloaded_at, notes')
    .eq('container_id', id).order('created_at');

  const piIds = (items ?? []).map((i: { production_item_id: string }) => i.production_item_id);
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
  const enriched = (items ?? []).map((i: { production_item_id: string }) => ({ ...i, production_item: piMap[i.production_item_id] ?? null }));

  return NextResponse.json({ container, items: enriched });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, } = await params;
  const { user, admin, deny } = await requireRole(CONTAINER_WRITE_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) patch[k] = body[k] === '' ? null : body[k];
  if ('status' in patch && !CONTAINER_STATUSES.includes(String(patch.status) as never)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  if ('delivery_destination' in patch && !['warehouse', 'direct_job_site'].includes(String(patch.delivery_destination))) {
    return NextResponse.json({ error: 'Invalid delivery destination' }, { status: 400 });
  }
  if (patch.status === 'DEPARTED' && !('departure_date' in patch)) patch.departure_date = new Date().toISOString().slice(0, 10);
  if (patch.status === 'ARRIVED_PORT' && !('actual_arrival_date' in patch)) patch.actual_arrival_date = new Date().toISOString().slice(0, 10);
  if (patch.status === 'WAREHOUSE' && !('warehouse_arrival_date' in patch)) patch.warehouse_arrival_date = new Date().toISOString().slice(0, 10);
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('containers').update(patch).eq('id', id).is('deleted_at', null).select(COLS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Container not found' }, { status: 404 });

  if (typeof patch.status === 'string' && CONTAINER_IN_TRANSIT.has(patch.status)) {
    const { data: links } = await admin.from('container_items').select('production_item_id').eq('container_id', id);
    const ids = (links ?? []).map((l: { production_item_id: string }) => l.production_item_id);
    if (ids.length) {
      await admin.from('production_items').update({ status: 'SENT', container_no: data.container_no ?? null }).in('id', ids).neq('status', 'SENT');

      const { data: moved } = await admin.from('production_items').select('project_id').in('id', ids) as {
        data: { project_id: string }[] | null;
      };
      for (const projectId of new Set((moved ?? []).map(m => m.project_id).filter(Boolean))) {
        await maybeEmitItemsReady(admin, projectId, user.id);
      }
    }
  }

  if (typeof patch.status === 'string' && CONTAINER_ARRIVAL_STATUSES.has(patch.status)) {
    await emitEvent(admin, {
      type: 'container.arrived',
      entityTable: 'containers',
      entityId: id,
      projectId: null,
      actorId: user.id,
      dedupeKey: `container.arrived:${id}:${patch.status}`,
      payload: { status: patch.status, containerNo: data.container_no ?? null },
    });
  }

  await logAudit({ actorId: user.id, action: 'container.updated', resource: `container:${id}`, newValue: patch });
  return NextResponse.json({ container: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(CONTAINER_WRITE_ROLES);
  if (deny) return deny;

  const { data, error } = await admin.from('containers').update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Container not found' }, { status: 404 });
  await admin.from('container_items').delete().eq('container_id', id);

  await logAudit({ actorId: user.id, action: 'container.deleted', resource: `container:${id}` });
  return NextResponse.json({ ok: true });
}
