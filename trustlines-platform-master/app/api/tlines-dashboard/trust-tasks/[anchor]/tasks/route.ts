import { NextResponse } from 'next/server';
import { requireTlinesDashboard } from '@/lib/keyClients/access';
import { TASK_COLUMNS, parseAnchor, tasksFailed } from '@/lib/board/trustTasks';
import { logAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

// Dashboard card popup → "Trust Lines Tasks" for one anchor (lib/board/trustTasks).
//   GET  → { tasks }            every dashboard viewer
//   POST { title } → { task }   dashboard managers
export async function GET(_req: Request, { params }: { params: Promise<{ anchor: string }> }) {
  const { admin, deny } = await requireTlinesDashboard();
  if (deny) return deny;
  const anchor = parseAnchor((await params).anchor);
  if (!anchor) return NextResponse.json({ error: 'Unknown card' }, { status: 400 });

  const { data, error } = await admin.from('trust_lines_tasks').select(TASK_COLUMNS)
    .eq('anchor', anchor).order('created_at', { ascending: true }).limit(200);
  if (error) return tasksFailed('list', error);

  const rows = (data ?? []) as { assignee_id: string | null }[];
  const ids = [...new Set(rows.map(t => t.assignee_id).filter(Boolean))];
  const { data: people } = ids.length ? await admin.from('profiles').select('id, full_name').in('id', ids) : { data: [] };
  const nameById = new Map(((people ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]));
  return NextResponse.json({
    tasks: rows.map(t => ({ ...t, assignee_name: t.assignee_id ? nameById.get(t.assignee_id) ?? null : null })),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ anchor: string }> }) {
  const { user, admin, canManage, deny } = await requireTlinesDashboard();
  if (deny) return deny;
  if (!canManage) return NextResponse.json({ error: 'You can’t add Trust Lines tasks' }, { status: 403 });
  const anchor = parseAnchor((await params).anchor);
  if (!anchor) return NextResponse.json({ error: 'Unknown card' }, { status: 400 });

  const body = await req.json().catch(() => null) as { title?: unknown } | null;
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 500) : '';
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });

  const { data, error } = await admin.from('trust_lines_tasks')
    .insert({ anchor, title, created_by: user.id }).select(TASK_COLUMNS).single();
  if (error) return tasksFailed('add', error);
  await logAudit({ actorId: user.id, action: 'dashboard.trust_task_add', resource: `trust_lines_tasks:${(data as { id: string }).id}`, newValue: { anchor, title } });
  return NextResponse.json({ task: { ...(data as object), assignee_name: null } });
}
