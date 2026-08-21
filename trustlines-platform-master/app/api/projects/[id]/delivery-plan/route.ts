import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { DELIVERY_READ_ROLES, DELIVERY_WRITE_ROLES, DELIVERY_METHODS, DELIVERY_STATUSES, BUILD_BY } from '@/lib/delivery/config';
import { STAGE_PHASE } from '@/lib/workflow/machine';

type Params = { params: Promise<{ id: string }> };
const COLS = 'id, project_id, delivery_method, installation_date, build_by, build_schedule, site_confirmed, customer_accepted, accepted_by, accepted_at, status, notes, created_at, updated_at';
const EDITABLE = ['delivery_method', 'installation_date', 'build_by', 'build_schedule', 'site_confirmed', 'notes', 'status'] as const;

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { admin, deny } = await requireRole(DELIVERY_READ_ROLES);
  if (deny) return deny;
  const res = await admin.from('delivery_plans').select(COLS).eq('project_id', id).maybeSingle();
  if (res.error) return NextResponse.json({ deliveryPlan: null });
  return NextResponse.json({ deliveryPlan: res.data ?? null });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(DELIVERY_WRITE_ROLES);
  if (deny) return deny;

  const { data: proj } = await admin.from('projects').select('id').eq('id', id).maybeSingle();
  if (!proj) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const found = await admin.from('delivery_plans').select('id').eq('project_id', id).maybeSingle();
  if (!found.data) {
    const created = await admin.from('delivery_plans').insert({ project_id: id, created_by: user.id }).select('id').single();
    if (created.error) return NextResponse.json({ error: created.error.message }, { status: 500 });
  }

  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) patch[k] = body[k] === '' ? null : body[k];
  if ('delivery_method' in patch && !DELIVERY_METHODS.includes(String(patch.delivery_method))) return NextResponse.json({ error: 'Invalid delivery method' }, { status: 400 });
  if ('build_by' in patch && patch.build_by && !BUILD_BY.includes(String(patch.build_by))) return NextResponse.json({ error: 'Invalid build_by' }, { status: 400 });
  if ('status' in patch && !DELIVERY_STATUSES.includes(String(patch.status))) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

  if (body.accept === true) {
    patch.customer_accepted = true;
    patch.accepted_by = String(body.acceptedBy ?? '').trim() || null;
    patch.accepted_at = new Date().toISOString();
  } else if (body.accept === false) {
    patch.customer_accepted = false; patch.accepted_by = null; patch.accepted_at = null;
  }

  let completed = false;
  if (body.complete === true) { patch.status = 'completed'; completed = true; }

  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('delivery_plans').update(patch).eq('project_id', id).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (completed) {
    await admin.from('projects').update({ current_stage: 'delivered', current_phase: STAGE_PHASE['delivered'] ?? 'delivery' }).eq('id', id);
    await admin.from('stage_transitions').insert({ project_id: id, to_stage: 'delivered', transitioned_by: user.id, is_override: false });
  }

  await logAudit({ actorId: user.id, action: completed ? 'delivery.completed' : 'delivery.updated', projectId: id, resource: `delivery_plan:${data.id}`, newValue: Object.keys(patch) });
  return NextResponse.json({ deliveryPlan: data, completed });
}
