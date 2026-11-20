import { NextResponse } from 'next/server';
import { requireTlinesDashboard } from '@/lib/keyClients/access';
import { TASK_STATUSES, anchorLabel, boardTaskAccess, cleanAssignee, ownSelfTask, cleanDate, parseAnchor, sideLabel, tasksFailed, type TaskSide } from '@/lib/board/trustTasks';
import { notifyUsers } from '@/lib/events/notify';
import { logAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f-]{36}$/i;
interface Row { title: string; status: string; assignee_id: string | null; due_date: string | null; side: TaskSide; created_by: string | null }

async function load(params: Promise<{ anchor: string; taskId: string }>) {
  const auth = await requireTlinesDashboard();
  if (auth.deny) return { deny: auth.deny } as const;
  const p = await params;
  const anchor = parseAnchor(p.anchor);
  if (!anchor || !UUID.test(p.taskId)) return { deny: NextResponse.json({ error: 'Unknown task' }, { status: 400 }) } as const;
  const { data, error } = await auth.admin.from('trust_lines_tasks').select('title, status, assignee_id, due_date, side, created_by')
    .eq('id', p.taskId).eq('anchor', anchor).maybeSingle();
  if (error) return { deny: tasksFailed('read', error) } as const;
  if (!data) return { deny: NextResponse.json({ error: 'Task not found' }, { status: 404 }) } as const;
  const access = await boardTaskAccess(auth.admin, auth.user.id, auth.role, auth.canManage);
  return { ...auth, access, anchor, taskId: p.taskId, old: data as Row, deny: null } as const;
}

// POST { title?, status?, assignee_id?, due_date? }. 'assign' changes anything; a task someone wrote
// for themselves they may change too (but not hand to someone else); the assignee may always tick
// their own task done / re-open it. A newly set assignee gets a notification.
export async function POST(req: Request, { params }: { params: Promise<{ anchor: string; taskId: string }> }) {
  const g = await load(params);
  if (g.deny) return g.deny;
  const { user, admin, access, anchor, taskId, old } = g;

  const body = (await req.json().catch(() => null) ?? {}) as Record<string, unknown>;
  const keys = Object.keys(body);
  const ownTick = keys.length === 1 && keys[0] === 'status' && old.assignee_id === user.id;
  const mine = ownSelfTask(old, user.id) && (!('assignee_id' in body) || body.assignee_id === user.id);
  if (access !== 'assign' && !ownTick && !mine) return NextResponse.json({ error: 'You can’t change this task' }, { status: 403 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim().slice(0, 500);
  if ('status' in body) {
    if (typeof body.status !== 'string' || !TASK_STATUSES.has(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    patch.status = body.status;
    patch.completed_at = body.status === 'done' ? new Date().toISOString() : null;
  }
  if ('assignee_id' in body) {
    const a = await cleanAssignee(admin, body.assignee_id);
    if (a === 'bad') return NextResponse.json({ error: 'Unknown user' }, { status: 400 });
    patch.assignee_id = a;
  }
  if ('due_date' in body) patch.due_date = cleanDate(body.due_date);

  const { error } = await admin.from('trust_lines_tasks').update(patch).eq('id', taskId).eq('anchor', anchor);
  if (error) return tasksFailed('update', error);

  if (patch.assignee_id && patch.assignee_id !== old.assignee_id && patch.assignee_id !== user.id) {
    await notifyUsers(admin, {
      userIds: [patch.assignee_id as string], actorId: user.id, projectId: null, type: 'task',
      title: `You were assigned a ${sideLabel(old.side)} task (${anchorLabel(anchor)})`,
      body: (patch.title as string | undefined) ?? old.title, link: '/dashboard',
    });
  }
  await logAudit({
    actorId: user.id, action: 'dashboard.board_task_update', resource: `trust_lines_tasks:${taskId}`,
    oldValue: old, newValue: { anchor, ...patch },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ anchor: string; taskId: string }> }) {
  const g = await load(params);
  if (g.deny) return g.deny;
  const { user, admin, access, anchor, taskId, old } = g;
  if (access !== 'assign' && !ownSelfTask(old, user.id)) return NextResponse.json({ error: 'You can’t delete this task' }, { status: 403 });
  const { error } = await admin.from('trust_lines_tasks').delete().eq('id', taskId).eq('anchor', anchor);
  if (error) return tasksFailed('delete', error);
  await logAudit({ actorId: user.id, action: 'dashboard.board_task_delete', resource: `trust_lines_tasks:${taskId}`, oldValue: { anchor, ...old } });
  return NextResponse.json({ ok: true });
}
