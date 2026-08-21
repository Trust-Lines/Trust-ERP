import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { CUSTOMER_COMMS_WRITE_ROLES } from '@/lib/customers/roles';

type Params = { params: Promise<{ id: string; meetingId: string }> };

const COLS = 'id, customer_id, lead_intake_id, project_id, title, meeting_type, meeting_at, location, attendees, notes, outcome, status, created_at';
const EDITABLE = ['title', 'meeting_type', 'meeting_at', 'location', 'attendees', 'notes', 'outcome', 'status'] as const;

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, meetingId } = await params;
  const { user, admin, deny } = await requireRole(CUSTOMER_COMMS_WRITE_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) patch[k] = body[k];

  if ('title' in patch) {
    const t = String(patch.title ?? '').trim();
    if (!t) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    patch.title = t;
  }
  if ('meeting_at' in patch) {
    const when = new Date(String(patch.meeting_at));
    if (Number.isNaN(when.getTime())) return NextResponse.json({ error: 'Invalid meeting date/time' }, { status: 400 });
    patch.meeting_at = when.toISOString();
  }
  if ('status' in patch && !['scheduled', 'completed', 'cancelled'].includes(String(patch.status))) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('customer_meetings').update(patch)
    .eq('id', meetingId).eq('customer_id', id).is('deleted_at', null).select(COLS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'customer_meeting.updated', resource: `customer_meeting:${meetingId}`, newValue: patch });
  return NextResponse.json({ meeting: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, meetingId } = await params;
  const { user, admin, deny } = await requireRole(CUSTOMER_COMMS_WRITE_ROLES);
  if (deny) return deny;

  const { data, error } = await admin.from('customer_meetings')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', meetingId).eq('customer_id', id).is('deleted_at', null).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'customer_meeting.deleted', resource: `customer_meeting:${meetingId}` });
  return NextResponse.json({ ok: true });
}
