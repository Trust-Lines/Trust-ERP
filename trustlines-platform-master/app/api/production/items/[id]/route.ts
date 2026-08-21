import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generatePfCode, projectNumberFromCode } from '@/lib/production/pfCode';
import { datesForStatusChange, type DateField } from '@/lib/production/board';
import { requireProductionWrite } from '@/lib/production/guard';
import { logAudit } from '@/lib/audit/log';
import { maybeEmitItemsReady } from '@/lib/events/triggers';

type Params = { params: Promise<{ id: string }> };

const FIXED_VENDORS = ['YSM', 'GOS'];
const EDITABLE = new Set([
  'vendor_id', 'order_type', 'po_sign_status', 'pf_sign_status', 'status',
  'etd', 'pf_usd', 'pf_tl', 'invoice', 'invoice_tl', 'expenses_usd', 'expenses_tl',
  'payment_rule', 'container_no', 'container_date',
  'assigned_to', 'priority', 'start_date', 'target_date',
]);

export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const { id } = await params;

  const body = await req.json() as Record<string, unknown>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: item } = await admin
    .from('production_items')
    .select('id, project_id, source, type, vendor_id, pf_code, order_type, status, std, etd, rtd, rtr, rdy, ftd, snd')
    .eq('id', id).is('deleted_at', null).single() as {
      data: {
        id: string; project_id: string; source: string; type: string;
        vendor_id: string | null; pf_code: string | null; order_type: string | null; status: string;
        std: string | null; etd: string | null; rtd: string | null; rtr: string | null;
        rdy: string | null; ftd: string | null; snd: string | null;
      } | null;
    };
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) if (EDITABLE.has(k)) update[k] = v;

  const nextVendorId  = ('vendor_id'  in update ? update.vendor_id  : item.vendor_id) as string | null;
  const nextOrderType = ('order_type' in update ? update.order_type : item.order_type) as string | null;

  const vendorChanged    = 'vendor_id'  in update && update.vendor_id  !== item.vendor_id;
  const orderTypeChanged = 'order_type' in update && update.order_type !== item.order_type;

  if (vendorChanged || orderTypeChanged) {
    if (!nextVendorId) {
      update.pf_code = null;
    } else {
      const { data: project } = await admin.from('projects').select('code').eq('id', item.project_id).single() as {
        data: { code: string } | null;
      };
      const { data: vendor } = await admin.from('suppliers').select('code').eq('id', nextVendorId).single() as {
        data: { code: string | null } | null;
      };
      const vendorCode = vendor?.code ?? '';
      const isFixed = FIXED_VENDORS.includes(vendorCode.toUpperCase()) && item.type === 'Millwork';

      if (vendorChanged || (orderTypeChanged && isFixed)) {
        let projectNo = projectNumberFromCode(project?.code ?? '');
        if (item.source === 'direct_order') projectNo = `PDO${projectNo}`;

        const { data: siblings } = await admin
          .from('production_items')
          .select('pf_code')
          .eq('project_id', item.project_id)
          .eq('type', item.type)
          .eq('vendor_id', nextVendorId)
          .neq('id', id)
          .is('deleted_at', null) as { data: { pf_code: string | null }[] | null };
        const existingCodes = (siblings ?? []).map(s => s.pf_code).filter(Boolean) as string[];

        update.pf_code = generatePfCode({
          vendorCode, projectNo, type: item.type, orderType: nextOrderType, existingCodes,
        });
      }
    }
  }

  if ('status' in update && update.status !== item.status) {
    const patch = datesForStatusChange(String(update.status), {
      std: item.std, etd: item.etd, rtd: item.rtd, rtr: item.rtr, rdy: item.rdy, ftd: item.ftd, snd: item.snd,
    });
    for (const [field, value] of Object.entries(patch)) update[field as DateField] = value;
  }

  update.updated_at = new Date().toISOString();

  const { data: updated, error } = await admin
    .from('production_items').update(update).eq('id', id).select('*').single() as {
      data: Record<string, unknown> | null; error: { message: string } | null;
    };
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: user.id, action: 'production.item_updated', projectId: item.project_id,
    resource: `${item.type} ${(updated?.pf_code as string) ?? ''}`.trim(),
    newValue: { fields: Object.keys(update) },
  });

  if ('status' in update && update.status !== item.status && update.status === 'SENT') {
    await maybeEmitItemsReady(admin, item.project_id, user.id);
  }

  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireProductionWrite();
  if (deny) return deny;
  const { id } = await params;

  const { data: item } = await admin.from('production_items')
    .select('id, project_id, source, type').eq('id', id).is('deleted_at', null).maybeSingle() as {
      data: { id: string; project_id: string; source: string; type: string } | null;
    };
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  const { error } = await admin.from('production_items')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'production.item_deleted', projectId: item.project_id, resource: `${item.source}:${item.type}` });
  return NextResponse.json({ ok: true });
}
