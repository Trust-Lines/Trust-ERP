import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { CUSTOMER_COMMS_WRITE_ROLES } from '@/lib/customers/roles';

type Params = { params: Promise<{ id: string; followUpId: string }> };

const COLS = 'id, customer_id, lead_intake_id, project_id, note, due_date, assignee_id, status, completed_at, created_at';
const EDITABLE = ['note', 'due_date', 'assignee_id', 'status'] as const;

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, followUpId } = await params;
  const { user, admin, deny } = await requireRole(CUSTOMER_COMMS_WRITE_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) patch[k] = body[k];

  if ('note' in patch) {
    const n = String(patch.note ?? '').trim();
    if (!n) return NextResponse.json({ error: 'Note cannot be empty' }, { status: 400 });
    patch.note = n;
  }
  if ('due_date' in patch) {
    if (!patch.due_date || Number.isNaN(new Date(String(patch.due_date)).getTime())) {
      return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
    }
  }
  if ('assignee_id' in patch) patch.assignee_id = patch.assignee_id || null;
  if ('status' in patch) {
    const s = String(patch.status);
    if (!['open', 'done', 'cancelled'].includes(s)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    if (s === 'done') { patch.completed_at = new Date().toISOString(); patch.completed_by = user.id; }
    else { patch.completed_at = null; patch.completed_by = null; }
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('customer_follow_ups').update(patch)
    .eq('id', followUpId).eq('customer_id', id).is('deleted_at', null).select(COLS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Follow-up not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'customer_follow_up.updated', resource: `customer_follow_up:${followUpId}`, newValue: patch });
  return NextResponse.json({ followUp: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, followUpId } = await params;
  const { user, admin, deny } = await requireRole(CUSTOMER_COMMS_WRITE_ROLES);
  if (deny) return deny;

  const { data, error } = await admin.from('customer_follow_ups')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', followUpId).eq('customer_id', id).is('deleted_at', null).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Follow-up not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'customer_follow_up.deleted', resource: `customer_follow_up:${followUpId}` });
  return NextResponse.json({ ok: true });
}
