import { NextResponse } from 'next/server';
import { requireTlinesDashboard } from '@/lib/keyClients/access';

// TLines dashboard → "Assign to" on a Trust System card. Body: { trustProjectId, projectNo, userId }
// — userId null clears it. Stored on our side (trust_project_assignees, migration 137); the
// Trust System itself is never written.
export async function PUT(req: Request) {
  const { user, admin, canManage, deny } = await requireTlinesDashboard();
  if (deny) return deny;
  if (!canManage) return NextResponse.json({ error: 'You can’t assign Trust projects' }, { status: 403 });

  const body = await req.json().catch(() => null) as { trustProjectId?: unknown; projectNo?: unknown; userId?: unknown } | null;
  const trustProjectId = typeof body?.trustProjectId === 'string' ? body.trustProjectId.trim() : '';
  const projectNo = typeof body?.projectNo === 'string' ? body.projectNo.trim().slice(0, 40) : null;
  const userId = typeof body?.userId === 'string' && body.userId ? body.userId : null;
  if (!trustProjectId || trustProjectId.length > 64) return NextResponse.json({ error: 'Missing project' }, { status: 400 });

  if (!userId) {
    const { error } = await admin.from('trust_project_assignees').delete().eq('trust_project_id', trustProjectId);
    if (error) return failed(error);
    return NextResponse.json({ ok: true, userId: null });
  }

  const { data: person } = await admin.from('profiles').select('id, full_name').eq('id', userId).eq('is_active', true).maybeSingle();
  if (!person) return NextResponse.json({ error: 'Unknown user' }, { status: 400 });
  const { error } = await admin.from('trust_project_assignees').upsert({
    trust_project_id: trustProjectId, project_no: projectNo, user_id: userId,
    assigned_by: user.id, updated_at: new Date().toISOString(),
  }, { onConflict: 'trust_project_id' });
  if (error) return failed(error);
  return NextResponse.json({ ok: true, userId, name: person.full_name });
}

function failed(error: { code?: string; message: string }) {
  if (error.code === '42P01' || /trust_project_assignees/.test(error.message)) {
    return NextResponse.json({ error: 'Assigning isn’t set up yet (migration 137)' }, { status: 503 });
  }
  console.error('[tlines-dashboard/trust-assignee]', error.message);
  return NextResponse.json({ error: 'Could not save the assignment' }, { status: 500 });
}
