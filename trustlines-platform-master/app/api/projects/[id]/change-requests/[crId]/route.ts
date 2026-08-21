import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { emitEvent } from '@/lib/events';
import { FINALIZATION_WRITE_ROLES, CHANGE_REQUEST_STATUSES, CHANGE_REQUEST_CATEGORIES } from '@/lib/finalization/config';

type Params = { params: Promise<{ id: string; crId: string }> };
const COLS = 'id, project_id, customer_contact_id, title, description, category, status, budget_impact, currency, timeline_impact_days, decision_note, resolved_at, created_at, updated_at';
const EDITABLE = ['title', 'description', 'category', 'status', 'budget_impact', 'timeline_impact_days', 'decision_note', 'customer_contact_id'] as const;

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, crId } = await params;
  const { user, admin, deny } = await requireRole(FINALIZATION_WRITE_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) patch[k] = body[k];

  if ('title' in patch) {
    const t = String(patch.title ?? '').trim();
    if (!t) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    patch.title = t;
  }
  if ('category' in patch && patch.category && !CHANGE_REQUEST_CATEGORIES.includes(String(patch.category))) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }
  if ('customer_contact_id' in patch) patch.customer_contact_id = patch.customer_contact_id || null;
  if ('status' in patch) {
    const s = String(patch.status);
    if (!(CHANGE_REQUEST_STATUSES as readonly string[]).includes(s)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    if (['approved', 'rejected', 'implemented', 'cancelled'].includes(s)) { patch.resolved_at = new Date().toISOString(); patch.resolved_by = user.id; }
    else { patch.resolved_at = null; patch.resolved_by = null; }
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('change_requests').update(patch)
    .eq('id', crId).eq('project_id', id).is('deleted_at', null).select(COLS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Change request not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'change_request.updated', projectId: id, resource: `change_request:${crId}`, newValue: patch });

  if (patch.status === 'approved') {
    await emitEvent(admin, {
      type: 'change_request.approved',
      entityTable: 'change_requests',
      entityId: crId,
      projectId: id,
      actorId: user.id,
      payload: { title: data.title },
    });
  }

  return NextResponse.json({ changeRequest: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, crId } = await params;
  const { user, admin, deny } = await requireRole(FINALIZATION_WRITE_ROLES);
  if (deny) return deny;

  const { data, error } = await admin.from('change_requests')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', crId).eq('project_id', id).is('deleted_at', null).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Change request not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'change_request.deleted', projectId: id, resource: `change_request:${crId}` });
  return NextResponse.json({ ok: true });
}
