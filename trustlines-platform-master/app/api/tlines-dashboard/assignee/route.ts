import { NextResponse } from 'next/server';
import { requireTlinesDashboard } from '@/lib/keyClients/access';

const KINDS = ['trust', 'opportunity', 'potential'];
const STAGES = ['opportunity', 'finalization', 'technical', 'to_production', 'in_production', 'shipped'];

// TLines dashboard → "Assign to" on a card, for the stage it is in.
// Body: { itemKind, itemId, stage, label, userId } — userId null clears it. Stored on our side
// (board_assignees, migration 137); the Trust System itself is never written.
export async function PUT(req: Request) {
  const { user, admin, canManage, deny } = await requireTlinesDashboard();
  if (deny) return deny;
  if (!canManage) return NextResponse.json({ error: 'You can’t assign dashboard cards' }, { status: 403 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const itemKind = str(body?.itemKind), itemId = str(body?.itemId), stage = str(body?.stage);
  const label = str(body?.label).slice(0, 120) || null;
  const userId = str(body?.userId) || null;
  if (!KINDS.includes(itemKind) || !STAGES.includes(stage) || !itemId || itemId.length > 64) {
    return NextResponse.json({ error: 'Missing card' }, { status: 400 });
  }
  const key = { item_kind: itemKind, item_id: itemId, stage };

  if (!userId) {
    const { error } = await admin.from('board_assignees').delete().match(key);
    if (error) return failed(error);
    return NextResponse.json({ ok: true, userId: null });
  }

  const { data: person } = await admin.from('profiles').select('id').eq('id', userId).eq('is_active', true).maybeSingle();
  if (!person) return NextResponse.json({ error: 'Unknown user' }, { status: 400 });
  const { error } = await admin.from('board_assignees').upsert({
    ...key, label, user_id: userId, assigned_by: user.id, updated_at: new Date().toISOString(),
  }, { onConflict: 'item_kind,item_id,stage' });
  if (error) return failed(error);
  return NextResponse.json({ ok: true, userId });
}

function failed(error: { code?: string; message: string }) {
  if (error.code === '42P01' || /board_assignees/.test(error.message)) {
    return NextResponse.json({ error: 'Assigning isn’t set up yet (migration 137)' }, { status: 503 });
  }
  console.error('[tlines-dashboard/assignee]', error.message);
  return NextResponse.json({ error: 'Could not save the assignment' }, { status: 500 });
}
