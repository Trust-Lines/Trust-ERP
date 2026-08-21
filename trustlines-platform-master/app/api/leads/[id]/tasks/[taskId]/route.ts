import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_INTAKE_ROLES } from '@/lib/sales/roles';
import { notifyUser } from '@/lib/sales/notify';
import { logLeadActivity } from '@/lib/sales/activity';
import { assertLeadAccess } from '@/lib/sales/leadAccess';

const STATUSES = new Set(['todo', 'in_progress', 'done']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await params;
  const { user, role, admin, deny } = await requireRole(SALES_INTAKE_ROLES);
  if (deny) return deny;
  const denied = await assertLeadAccess(admin, id, user.id, role);
  if (denied) return denied;

  const body = await req.json() as { status?: string; assignee_id?: string | null; title?: string; due_date?: string | null };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.status) {
    if (!STATUSES.has(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    patch.status = body.status;
    patch.completed_at = body.status === 'done' ? new Date().toISOString() : null;
  }
  if ('assignee_id' in body) patch.assignee_id = body.assignee_id || null;
  if ('title' in body && body.title?.trim()) patch.title = body.title.trim();
  if ('due_date' in body) patch.due_date = body.due_date || null;

  const { error } = await admin.from('lead_tasks').update(patch).eq('id', taskId).eq('lead_intake_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (patch.assignee_id && patch.assignee_id !== user.id) {
    const { data: t } = await admin.from('lead_tasks').select('title').eq('id', taskId).single();
    const title = (t as { title?: string } | null)?.title ?? 'a task';
    await notifyUser(admin, { userId: patch.assignee_id as string, title: 'You were assigned a task', body: title, leadId: id });
    await logLeadActivity(admin, { leadIntakeId: id, actorId: user.id, kind: 'change', body: `assigned task "${title}"` });
  }
  if (patch.status === 'done') {
    const { data: t } = await admin.from('lead_tasks').select('title').eq('id', taskId).single();
    await logLeadActivity(admin, { leadIntakeId: id, actorId: user.id, kind: 'change', body: `completed task "${(t as { title?: string } | null)?.title ?? ''}"` });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await params;
  const { user, role, admin, deny } = await requireRole(SALES_INTAKE_ROLES);
  if (deny) return deny;
  const denied = await assertLeadAccess(admin, id, user.id, role);
  if (denied) return denied;

  const { error } = await admin.from('lead_tasks').delete().eq('id', taskId).eq('lead_intake_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
