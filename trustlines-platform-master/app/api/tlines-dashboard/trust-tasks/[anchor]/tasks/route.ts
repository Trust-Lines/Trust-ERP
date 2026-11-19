import { NextResponse } from 'next/server';
import { requireTlinesDashboard } from '@/lib/keyClients/access';
import { TASK_COLUMNS, anchorLabel, boardTaskAccess, cleanAssignee, cleanDate, parseAnchor, parseSide, sideLabel, tasksFailed } from '@/lib/board/trustTasks';
import { notifyUsers } from '@/lib/events/notify';
import { logAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

// Dashboard card popup → the project's meeting task list (lib/board/trustTasks), ?side=tlines|trust.
//   GET  → { tasks, access }                           every dashboard viewer
//   POST { title, assignee_id?, due_date? } → { task } 'assign' for anyone (the assignee is
//        notified); everyone else only for themselves (boardTaskAccess)
export async function GET(req: Request, { params }: { params: Promise<{ anchor: string }> }) {
  const { user, role, admin, canManage, deny } = await requireTlinesDashboard();
  if (deny) return deny;
  const anchor = parseAnchor((await params).anchor);
  const side = parseSide(req);
  if (!anchor || !side) return NextResponse.json({ error: 'Unknown card' }, { status: 400 });
  const access = await boardTaskAccess(admin, user.id, role, canManage);

  const { data, error } = await admin.from('trust_lines_tasks').select(TASK_COLUMNS)
    .eq('anchor', anchor).eq('side', side).order('created_at', { ascending: true }).limit(300);
  if (error) return tasksFailed('list', error);

  const rows = (data ?? []) as { assignee_id: string | null }[];
  const ids = [...new Set(rows.map(t => t.assignee_id).filter(Boolean))];
  const { data: people } = ids.length ? await admin.from('profiles').select('id, full_name').in('id', ids) : { data: [] };
  const nameById = new Map(((people ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]));
  return NextResponse.json({
    tasks: rows.map(t => ({ ...t, assignee_name: t.assignee_id ? nameById.get(t.assignee_id) ?? null : null })),
    access,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ anchor: string }> }) {
  const { user, role, admin, canManage, deny } = await requireTlinesDashboard();
  if (deny) return deny;
  const access = await boardTaskAccess(admin, user.id, role, canManage);
  const anchor = parseAnchor((await params).anchor);
  const side = parseSide(req);
  if (!anchor || !side) return NextResponse.json({ error: 'Unknown card' }, { status: 400 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 500) : '';
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });
  // Without 'assign' a task is always for the person writing it.
  const assignee = access === 'assign' ? await cleanAssignee(admin, body?.assignee_id) : user.id;
  if (assignee === 'bad') return NextResponse.json({ error: 'Unknown user' }, { status: 400 });
  const due = cleanDate(body?.due_date);

  const { data, error } = await admin.from('trust_lines_tasks')
    .insert({ anchor, side, title, assignee_id: assignee, due_date: due, created_by: user.id })
    .select(TASK_COLUMNS).single();
  if (error) return tasksFailed('add', error);
  const task = data as { id: string };

  if (assignee && assignee !== user.id) {
    await notifyUsers(admin, {
      userIds: [assignee], actorId: user.id, projectId: null, type: 'task',
      title: `New ${sideLabel(side)} task for you (${anchorLabel(anchor)})`, body: title, link: '/dashboard',
    });
  }
  await logAudit({ actorId: user.id, action: 'dashboard.board_task_add', resource: `trust_lines_tasks:${task.id}`, newValue: { anchor, side, title, assignee_id: assignee, due_date: due } });
  return NextResponse.json({ task: { ...task, assignee_name: null } });
}
