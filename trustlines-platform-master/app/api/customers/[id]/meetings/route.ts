import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { CUSTOMER_COMMS_WRITE_ROLES } from '@/lib/customers/roles';

type Params = { params: Promise<{ id: string }> };

const COLS = 'id, customer_id, lead_intake_id, project_id, title, meeting_type, meeting_at, location, attendees, notes, outcome, status, created_at';
const TYPES = ['discovery', 'site_visit', 'presentation', 'handover', 'other'];

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(CUSTOMER_COMMS_WRITE_ROLES);
  if (deny) return deny;

  const { data: parent } = await admin.from('customers').select('id').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!parent) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

  const b = await req.json().catch(() => null) as {
    title?: string; meeting_at?: string; meeting_type?: string; location?: string;
    attendees?: string; notes?: string; outcome?: string; status?: string;
    lead_intake_id?: string | null; project_id?: string | null;
  } | null;

  const title = b?.title?.trim();
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  if (!b?.meeting_at) return NextResponse.json({ error: 'Meeting date/time is required' }, { status: 400 });
  const when = new Date(b.meeting_at);
  if (Number.isNaN(when.getTime())) return NextResponse.json({ error: 'Invalid meeting date/time' }, { status: 400 });

  const status = ['scheduled', 'completed', 'cancelled'].includes(b?.status ?? '') ? b!.status : 'scheduled';
  const meetingType = TYPES.includes(b?.meeting_type ?? '') ? b!.meeting_type : null;

  const { data, error } = await admin.from('customer_meetings').insert({
    customer_id: id,
    lead_intake_id: b?.lead_intake_id || null,
    project_id: b?.project_id || null,
    title,
    meeting_type: meetingType,
    meeting_at: when.toISOString(),
    location: b?.location?.trim() || null,
    attendees: b?.attendees?.trim() || null,
    notes: b?.notes?.trim() || null,
    outcome: b?.outcome?.trim() || null,
    status,
    created_by: user.id,
  }).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'customer_meeting.created', resource: `customer_meeting:${data.id}`, newValue: { customer_id: id, title } });
  return NextResponse.json({ meeting: data }, { status: 201 });
}
