import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireRole(['ops_manager', 'general_manager'], 'Not authorized');
  if (deny) return deny;

  const { id } = await params;

  const body = await req.json() as Record<string, unknown>;
  const allowed = [
    'prod_pm_ms_id', 'prod_pm_ci_id', 'trustlines_pm_id', 'tlines_pm_id', 'qc_inspector_id',
    'name', 'site_location', 'closed_deal_date', 'est_delivery_date',
    'categories', 'deal_value', 'currency', 'clickup_task_id', 'quickbooks_ref',
  ];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key] ?? null;
  }
  if (Object.keys(patch).length === 0 && !('category_values' in body)) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await admin.from('projects').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if ('category_values' in body) {
    const { error: cvErr } = await admin.from('projects')
      .update({ category_values: body.category_values ?? {} }).eq('id', id);
    if (cvErr && !/column|schema cache/i.test(cvErr.message ?? '')) {
      return NextResponse.json({ error: cvErr.message }, { status: 500 });
    }
  }

  await logAudit({ actorId: user.id, action: 'project.updated', projectId: id, resource: 'project', newValue: { ...patch, ...('category_values' in body ? { category_values: body.category_values } : {}) } });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, admin, deny } = await requireRole(['ops_manager', 'general_manager'], 'Not authorized');
  if (deny) return deny;

  const { id } = await params;

  const { error } = await admin
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ actorId: user.id, action: 'project.deleted', projectId: id, resource: 'project' });
  return NextResponse.json({ success: true });
}
