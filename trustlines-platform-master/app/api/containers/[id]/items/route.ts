import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { CONTAINER_READ_ROLES, CONTAINER_WRITE_ROLES } from '@/lib/logistics/containers';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  await params;
  const { admin, deny } = await requireRole(CONTAINER_READ_ROLES);
  if (deny) return deny;

  const url = new URL(req.url);
  if (url.searchParams.get('available') !== '1') return NextResponse.json({ items: [] });
  const q = (url.searchParams.get('q') ?? '').trim();

  const { data: taken } = await admin.from('container_items').select('production_item_id');
  const takenIds = new Set((taken ?? []).map((t: { production_item_id: string }) => t.production_item_id));

  let pq = admin.from('production_items').select('id, pf_code, type, status, project_id').is('deleted_at', null).limit(400);
  if (q) { const safe = q.replace(/[%,()\\]/g, '\\$&'); pq = pq.or(`pf_code.ilike.%${safe}%,type.ilike.%${safe}%`); }
  const { data: pis, error } = await pq;
  if (error) return NextResponse.json({ items: [] });

  const rows = (pis ?? []).filter((p: { id: string }) => !takenIds.has(p.id));
  const projIds = [...new Set(rows.map((p: { project_id: string }) => p.project_id))];
  const projCode: Record<string, string> = {};
  if (projIds.length) {
    const { data: projs } = await admin.from('projects').select('id, code').in('id', projIds);
    for (const p of (projs ?? []) as { id: string; code: string }[]) projCode[p.id] = p.code;
  }
  const items = rows.slice(0, 100).map((p: { id: string; pf_code: string | null; type: string; status: string; project_id: string }) =>
    ({ id: p.id, pf_code: p.pf_code, type: p.type, status: p.status, project_code: projCode[p.project_id] ?? null }));
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(CONTAINER_WRITE_ROLES);
  if (deny) return deny;

  const { data: container } = await admin.from('containers').select('id, container_no').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!container) return NextResponse.json({ error: 'Container not found' }, { status: 404 });

  const b = await req.json().catch(() => null) as {
    productionItemId?: string; quantity?: number; package_count?: number; pallet_count?: number; gross_weight?: number; volume_cbm?: number; notes?: string;
  } | null;
  if (!b?.productionItemId) return NextResponse.json({ error: 'productionItemId is required' }, { status: 400 });

  const { data: pi } = await admin.from('production_items').select('id').eq('id', b.productionItemId).maybeSingle();
  if (!pi) return NextResponse.json({ error: 'Production item not found' }, { status: 404 });

  const { data, error } = await admin.from('container_items').insert({
    container_id: id, production_item_id: b.productionItemId,
    quantity: b.quantity ?? null, package_count: b.package_count ?? null, pallet_count: b.pallet_count ?? null,
    gross_weight: b.gross_weight ?? null, volume_cbm: b.volume_cbm ?? null,
    loaded_at: new Date().toISOString(), notes: b.notes?.trim() || null, created_by: user.id,
  }).select('id, production_item_id, quantity, package_count, pallet_count, gross_weight, volume_cbm, loaded_at, unloaded_at, notes').single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'That item is already loaded in a container' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from('production_items').update({ container_no: container.container_no ?? null, container_date: new Date().toISOString().slice(0, 10) }).eq('id', b.productionItemId);

  await logAudit({ actorId: user.id, action: 'container.item_loaded', resource: `container_item:${data.id}`, newValue: { container: id, productionItem: b.productionItemId } });
  return NextResponse.json({ item: data }, { status: 201 });
}
