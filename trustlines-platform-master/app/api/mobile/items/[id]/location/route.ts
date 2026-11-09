import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { tableMissing } from '@/lib/hr/requests';
import { WAREHOUSE_WRITE_ROLES } from '@/lib/warehouse/roles';

/** PUT { location, received? } — receiving (011) / put-away (039): where the item sits now. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, admin, deny } = await requireRole(WAREHOUSE_WRITE_ROLES);
  if (deny) return deny;
  const { id } = await params;
  const b = await req.json().catch(() => null) as { location?: unknown; received?: unknown } | null;
  const location = typeof b?.location === 'string' ? b.location.trim().toUpperCase().slice(0, 40) : '';
  if (!location) return NextResponse.json({ error: 'location is required' }, { status: 400 });

  const { data: item } = await admin.from('production_items').select('id, project_id, type').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  const { data: prev } = await admin.from('warehouse_locations').select('location, received_at').eq('production_item_id', id).maybeSingle();

  const now = new Date().toISOString();
  const { data, error } = await admin.from('warehouse_locations').upsert({
    production_item_id: id, location, updated_by: user.id, updated_at: now,
    received_at: prev?.received_at ?? (b?.received === true ? now : null),
  }).select('location, received_at, updated_at').single();
  if (tableMissing(error, 'warehouse_locations')) return NextResponse.json({ error: 'Warehouse is not set up yet — migration 145 has not been applied.' }, { status: 503 });
  if (error) return NextResponse.json({ error: 'Could not save the location' }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'warehouse.item_located', projectId: item.project_id, resource: `production_item:${id}`, oldValue: prev ?? null, newValue: { location } });
  return NextResponse.json({ location: data });
}
