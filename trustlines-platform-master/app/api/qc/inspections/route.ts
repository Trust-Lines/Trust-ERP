import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { isInspectable } from '@/lib/qc/queue';

const QC_WRITE_ROLES = ['qc_responsible', 'production_manager', 'ops_manager', 'general_manager', 'project_manager'];

export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireRole(QC_WRITE_ROLES, 'Forbidden — you cannot open a QC inspection');
  if (deny) return deny;

  const body = await req.json() as { production_item_id?: string; rework_of_id?: string | null };
  if (!body.production_item_id)
    return NextResponse.json({ error: 'production_item_id is required' }, { status: 400 });

  const { data: item } = await admin.from('production_items')
    .select('id, project_id, type, status, deleted_at').eq('id', body.production_item_id).maybeSingle();
  if (!item || item.deleted_at)
    return NextResponse.json({ error: 'Production item not found' }, { status: 404 });
  if (!isInspectable(item.status))
    return NextResponse.json(
      { error: `Nothing to inspect yet — the item is ${item.status}, not received` }, { status: 400 });

  if (body.rework_of_id) {
    const { data: prev } = await admin.from('qc_checklists')
      .select('id, production_item_id, overall_result').eq('id', body.rework_of_id).maybeSingle();
    if (!prev || prev.production_item_id !== body.production_item_id)
      return NextResponse.json({ error: 'rework_of_id is not an inspection of this item' }, { status: 400 });
    if (prev.overall_result !== 'fail')
      return NextResponse.json({ error: 'Only a failed inspection can be reworked' }, { status: 400 });
  }

  const { data, error } = await admin.from('qc_checklists').insert({
    project_id: item.project_id,
    production_item_id: item.id,
    form_code: `QC-${item.type ?? 'ITEM'}`,
    overall_result: 'pending',
    conducted_by: user.id,
    rework_of_id: body.rework_of_id ?? null,
    sections: [],
  }).select('id, project_id, production_item_id, overall_result, conducted_by, conducted_at, rework_of_id').single();

  if (error?.code === '23505')
    return NextResponse.json({ error: 'An inspection is already open for this item — reload' }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: user.id,
    action: body.rework_of_id ? 'qc.rework_opened' : 'qc.opened',
    resource: `qc:${data.id}`,
    newValue: { production_item_id: item.id, type: item.type, rework_of_id: body.rework_of_id ?? null },
  });

  return NextResponse.json({ success: true, inspection: data });
}

export async function PATCH(req: NextRequest) {
  const { user, admin, deny } = await requireRole(QC_WRITE_ROLES, 'Forbidden — you cannot decide a QC inspection');
  if (deny) return deny;

  const body = await req.json() as { id?: string; result?: string; notes?: string | null; photos?: unknown };
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  if (body.result !== 'pass' && body.result !== 'fail')
    return NextResponse.json({ error: "result must be 'pass' or 'fail'" }, { status: 400 });

  const { data: existing } = await admin.from('qc_checklists')
    .select('id, overall_result, conducted_by, production_item_id, project_id, deleted_at')
    .eq('id', body.id).maybeSingle();
  if (!existing || existing.deleted_at)
    return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
  if (existing.overall_result !== 'pending')
    return NextResponse.json(
      { error: `Already ${existing.overall_result} — open a rework inspection instead` }, { status: 409 });

  const { data, error } = await admin.from('qc_checklists').update({
    overall_result: body.result,
    conducted_by: existing.conducted_by ?? user.id,
    conducted_at: new Date().toISOString(),
    notes: body.notes ?? null,
    photos: Array.isArray(body.photos) ? body.photos : [],
  }).eq('id', body.id)
    .eq('overall_result', 'pending')
    .select('id, project_id, production_item_id, overall_result, conducted_by, conducted_at, rework_of_id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorId: user.id, action: `qc.${body.result}`, resource: `qc:${body.id}`,
    oldValue: { overall_result: existing.overall_result },
    newValue: { overall_result: body.result, production_item_id: existing.production_item_id },
  });

  return NextResponse.json({ success: true, inspection: data });
}
