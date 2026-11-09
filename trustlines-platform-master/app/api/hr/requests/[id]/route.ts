import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { canManage } from '@/lib/hr/requests';

/**
 * PATCH { action: 'approve' | 'reject' | 'cancel', note? }
 * approve / reject: the requester's manager or ops / GM (never yourself); only while pending.
 * cancel: the requester, only while pending. Approving a correction writes that punch.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  const { id } = await params;
  const b = await req.json().catch(() => null) as { action?: string; note?: string } | null;
  const action = b?.action;
  if (!action || !['approve', 'reject', 'cancel'].includes(action)) return NextResponse.json({ error: 'action must be approve, reject or cancel' }, { status: 400 });
  const note = typeof b?.note === 'string' ? b.note.trim().slice(0, 1000) || null : null;
  if (action === 'reject' && !note) return NextResponse.json({ error: 'A rejection reason is required' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: r } = await admin.from('hr_requests')
    .select('id, user_id, kind, status, correction_kind, correction_at, description').eq('id', id).maybeSingle();
  if (!r) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  if (r.status !== 'pending') return NextResponse.json({ error: `Already ${r.status}` }, { status: 409 });

  if (action === 'cancel') {
    if (r.user_id !== user.id) return NextResponse.json({ error: 'Only the requester can cancel' }, { status: 403 });
  } else {
    const [{ data: me }, { data: target }] = await Promise.all([
      admin.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      admin.from('profiles').select('id, manager_id').eq('id', r.user_id).maybeSingle(),
    ]);
    if (!target || !canManage({ id: user.id, role: me?.role ?? null }, target))
      return NextResponse.json({ error: 'You cannot decide this request' }, { status: 403 });
  }

  const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'cancelled';
  // .eq('status','pending') makes a double tap / race a no-op instead of a second decision.
  const { data, error } = await admin.from('hr_requests').update({
    status, decision_note: note, decided_by: user.id, decided_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', id).eq('status', 'pending').select('id, status').maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not save the decision' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Already decided — refresh' }, { status: 409 });

  if (status === 'approved' && r.kind === 'correction') {
    const { error: pErr } = await admin.from('time_punches').insert({
      user_id: r.user_id, kind: r.correction_kind, punched_at: r.correction_at, source: 'correction',
      note: `Düzeltme talebi ${r.id}: ${r.description ?? ''}`.slice(0, 500),
    });
    if (pErr) console.error('[hr/requests] correction punch failed', pErr.message);
  }

  await logAudit({ actorId: user.id, action: `hr.request_${status}`, resource: `hr_request:${id}`, newValue: { status, note } });
  return NextResponse.json({ request: data });
}
