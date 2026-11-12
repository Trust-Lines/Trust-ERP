import { NextRequest, NextResponse } from 'next/server';
import { requireVendorAccess } from '@/lib/production/vendorAccess';
import { requireProductionWrite } from '@/lib/production/guard';
import { PROD_KEYS } from '@/lib/production/access';
import { logAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

// The Production tracker's Order Type list (production_order_types, migration 151), alphabetical.
// Before that migration the list is the order types already used on rows.
export async function GET() {
  const { admin, deny } = await requireVendorAccess('read');
  if (deny) return deny;
  const { data, error } = await admin.from('production_order_types').select('name').eq('is_active', true) as { data: { name: string }[] | null; error: unknown };
  let names = (data ?? []).map(r => r.name.trim()).filter(Boolean);
  if (error) {
    const { data: used } = await admin.from('production_items').select('order_type').not('order_type', 'is', null).is('deleted_at', null).limit(5000) as { data: { order_type: string }[] | null };
    names = [...new Set((used ?? []).map(r => r.order_type.trim()).filter(Boolean))];
  }
  names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  return NextResponse.json({ orderTypes: names });
}

/** Add an order type from the cell ("+ Add order type"). Same name in any case = 409. */
export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireProductionWrite(PROD_KEYS.editRows);
  if (deny) return deny;
  const { name } = await req.json().catch(() => ({})) as { name?: string };
  const clean = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (clean.length < 2) return NextResponse.json({ error: 'Order type must be at least 2 characters' }, { status: 400 });
  const { data, error } = await admin.from('production_order_types').insert({ name: clean, created_by: user.id }).select('name').single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: `Order type '${clean}' already exists` }, { status: 409 });
    return NextResponse.json({ error: 'Could not add the order type' }, { status: 500 });
  }
  await logAudit({ actorId: user.id, action: 'production.order_type_created', resource: clean });
  return NextResponse.json({ orderType: data.name });
}
