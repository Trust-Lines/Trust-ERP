import { NextResponse } from 'next/server';
import { requireTlinesDashboard } from '@/lib/keyClients/access';
import { TASK_STATUSES, anchorLabel, parseAnchor, tasksFailed } from '@/lib/board/trustTasks';
import { notifyUsers } from '@/lib/events/notify';
import { logAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f-]{36}$/i;

async function guard(params: Promise<{ anchor: string; taskId: string }>) {
  const auth = await requireTlinesDashboard();
  if (auth.deny) return { deny: auth.deny } as const;
  if (!auth.canManage) return { deny: NextResponse.json({ error: 'You can’t change Trust Lines tasks' }, { status: 403 }) } as const;
  const p = await params;
  const anchor = parseAnchor(p.anchor);
  if (!anchor || !UUID.test(p.taskId)) return { deny: NextResponse.json({ error: 'Unknown task' }, { status: 400 }) } as const;
  return { ...auth, anchor, taskId: p.taskId, deny: null } as const;
}

// POST { title?, status?, assignee_id?, due_date? } — a newly set assignee gets a notification.
export async function POST(req: Request, { params }: { params: Promise<{ anchor: string; taskId: string }> }) {
  const g = await guard(params);
  if (g.deny) return g.deny;
  const { user, admin, anchor, taskId } = g;

  const { data: before } = await admin.from('trust_lines_tasks').select('title, status, assignee_id, due_date')
    .eq('id', taskId).eq('anchor', anchor).maybeSingle();
  if (!before) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  const old = before as { title: string; status: string; assignee_id: string | null; due_date: string | null };

  const body = (await req.json().catch(() => null) ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim().slice(0, 500);
  if ('status' in body) {
    if (typeof body.status !== 'string' || !TASK_STATUSES.has(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    patch.status = body.status;
    patch.completed_at = body.status === 'done' ? new Date().toISOString() : null;
  }
  if ('assignee_id' in body) {
    const id = typeof body.assignee_id === 'string' && body.assignee_id ? body.assignee_id : null;
    if (id) {
      const { data: person } = await admin.from('profiles').select('id').eq('id', id).eq('is_active', true).maybeSingle();
      if (!person) return NextResponse.json({ error: 'Unknown user' }, { status: 400 });
    }
    patch.assignee_id = id;
  }
  if ('due_date' in body) {
    const d = typeof body.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.due_date) ? body.due_date : null;
    patch.due_date = d;
  }

  const { error } = await admin.from('trust_lines_tasks').update(patch).eq('id', taskId).eq('anchor', anchor);
  if (error) return tasksFailed('update', error);

  const title = (patch.title as string | undefined) ?? old.title;
  if (patch.assignee_id && patch.assignee_id !== old.assignee_id) {
    await notifyUsers(admin, {
      userIds: [patch.assignee_id as string], actorId: user.id, projectId: null, type: 'task',
      title: `You were assigned a Trust Lines task (${anchorLabel(anchor)})`, body: title, link: '/dashboard',
    });
  }
  await logAudit({
    actorId: user.id, action: 'dashboard.trust_task_update', resource: `trust_lines_tasks:${taskId}`,
    oldValue: old, newValue: { anchor, ...patch },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ anchor: string; taskId: string }> }) {
  const g = await guard(params);
  if (g.deny) return g.deny;
  const { user, admin, anchor, taskId } = g;
  const { data: before } = await admin.from('trust_lines_tasks').select('title, status, assignee_id')
    .eq('id', taskId).eq('anchor', anchor).maybeSingle();
  if (!before) return NextResponse.json({ ok: true });
  const { error } = await admin.from('trust_lines_tasks').delete().eq('id', taskId).eq('anchor', anchor);
  if (error) return tasksFailed('delete', error);
  await logAudit({ actorId: user.id, action: 'dashboard.trust_task_delete', resource: `trust_lines_tasks:${taskId}`, oldValue: { anchor, ...(before as object) } });
  return NextResponse.json({ ok: true });
}
