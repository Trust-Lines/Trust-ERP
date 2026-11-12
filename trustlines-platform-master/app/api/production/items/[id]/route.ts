import { NextRequest, NextResponse } from 'next/server';
import { computeBoardPfCode, isFurnitureOrder, pfOwnerForCase, pfOwnerForProject, PF_CODE_SIGN_STATUSES } from '@/lib/production/pfCode';
import { datesForStatusChange, type DateField } from '@/lib/production/board';
import { requireProductionWrite } from '@/lib/production/guard';
import { PROD_KEYS, STATUS_FIELDS } from '@/lib/production/access';
import { logAudit } from '@/lib/audit/log';
import { maybeEmitItemsReady } from '@/lib/events/triggers';

type Params = { params: Promise<{ id: string }> };

const EDITABLE = new Set([
  'vendor_id', 'order_type', 'po_sign_status', 'pf_sign_status', 'status',
  'etd', 'pf_usd', 'pf_tl', 'invoice', 'invoice_tl', 'expenses_usd', 'expenses_tl',
  'payment_rule', 'container_no', 'container_date',
  'assigned_to', 'priority', 'start_date', 'target_date',
]);
const MONEY_FIELDS = new Set(['pf_usd', 'pf_tl', 'invoice', 'invoice_tl', 'expenses_usd', 'expenses_tl']);

export async function PATCH(req: NextRequest, { params }: Params) {
  // Roles page → Production Board: status cells need "Change statuses", the other fields "Edit
  // rows", money fields also "Money columns" (each follows edit.production until set).
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const sent = Object.keys(body).filter(k => EDITABLE.has(k));
  const keys = new Set<string>();
  for (const k of sent) {
    keys.add(STATUS_FIELDS.has(k) ? PROD_KEYS.editStatus : PROD_KEYS.editRows);
    if (MONEY_FIELDS.has(k)) keys.add(PROD_KEYS.viewMoney);
  }
  const { user, admin, deny } = await requireProductionWrite(keys.size ? [...keys] : 'edit.production');
  if (deny) return deny;
  const { id } = await params;

  const { data: item } = await admin
    .from('production_items')
    .select('id, project_id, case_id, source, type, custom_type_code, vendor_id, pf_code, order_type, pf_sign_status, status, std, etd, rtd, rtr, rdy, ftd, snd')
    .eq('id', id).is('deleted_at', null).single() as {
      data: {
        id: string; project_id: string | null; case_id: string | null; source: string; type: string; custom_type_code: string | null;
        pf_sign_status: string | null;
        vendor_id: string | null; pf_code: string | null; order_type: string | null; status: string;
        std: string | null; etd: string | null; rtd: string | null; rtr: string | null;
        rdy: string | null; ftd: string | null; snd: string | null;
      } | null;
    };
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) if (EDITABLE.has(k)) update[k] = v;

  // ── PF code (Trust System rules, lib/production/pfCode.ts). The client never sends one. ──
  const next = <T,>(k: string, cur: T) => (k in update ? update[k] : cur) as T;
  const nextVendorId = next<string | null>('vendor_id', item.vendor_id);
  const nextOrderType = next<string | null>('order_type', item.order_type);
  const nextPfSign = next<string | null>('pf_sign_status', item.pf_sign_status);
  const isCase = !!item.case_id;
  // Projects: vendor + a PF sign status that carries a code. Direct Orders / Missing & Extra: vendor.
  const eligible = !!nextVendorId && (isCase || PF_CODE_SIGN_STATUSES.has(String(nextPfSign ?? '')));
  const wasEligible = !!item.vendor_id && (isCase || PF_CODE_SIGN_STATUSES.has(String(item.pf_sign_status ?? '')));

  if (!eligible) {
    if (item.pf_code) update.pf_code = null;
  } else {
    const { data: vendor } = await admin.from('suppliers').select('*').eq('id', nextVendorId).single() as {
      data: { code: string | null; fixed_millwork_codes?: boolean } | null;
    };
    const fixed = !!vendor?.fixed_millwork_codes;
    const orderTypeMatters = item.type === 'Millwork'
      && (fixed || isFurnitureOrder(item.order_type) !== isFurnitureOrder(nextOrderType));
    const recompute = !item.pf_code || !wasEligible || nextVendorId !== item.vendor_id
      || ('order_type' in update && nextOrderType !== item.order_type && orderTypeMatters);
    if (recompute) {
      let owner = '';
      if (item.case_id) {
        const { data: c } = await admin.from('production_cases').select('kind, code').eq('id', item.case_id).single() as { data: { kind: string; code: string } | null };
        owner = c ? pfOwnerForCase(c.kind, c.code) : '';
      } else if (item.project_id) {
        const { data: proj } = await admin.from('projects').select('code, trust_raw').eq('id', item.project_id).single() as {
          data: { code: string; trust_raw: { projectNo?: string } | null } | null;
        };
        owner = proj ? pfOwnerForProject(proj.code, proj.trust_raw?.projectNo) : '';
      }
      // This vendor's other rows under the same project / case. Live rows hold their numbers;
      // trashed rows count too for the max + 1 sequence, so deleted numbers aren't reused.
      let sib = admin.from('production_items').select('pf_code, deleted_at').eq('vendor_id', nextVendorId).neq('id', id)
        .not('pf_code', 'is', null);
      sib = item.case_id ? sib.eq('case_id', item.case_id) : sib.eq('project_id', item.project_id).eq('source', item.source);
      const { data: siblings } = await sib as { data: { pf_code: string; deleted_at: string | null }[] | null };
      update.pf_code = computeBoardPfCode({
        vendorCode: vendor?.code ?? null, fixedMillwork: fixed, owner, type: item.type,
        customTypeCode: item.custom_type_code, orderType: nextOrderType,
        siblingCodes: (siblings ?? []).filter(r => !r.deleted_at).map(r => r.pf_code),
        allSiblingCodes: (siblings ?? []).map(r => r.pf_code),
      });
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

  if ('status' in update && update.status !== item.status && update.status === 'SENT' && item.project_id) {
    await maybeEmitItemsReady(admin, item.project_id, user.id);
  }

  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireProductionWrite(PROD_KEYS.deleteRows);
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
