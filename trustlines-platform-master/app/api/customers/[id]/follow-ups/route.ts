import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { CUSTOMER_COMMS_WRITE_ROLES } from '@/lib/customers/roles';

type Params = { params: Promise<{ id: string }> };

const COLS = 'id, customer_id, lead_intake_id, project_id, note, due_date, assignee_id, status, completed_at, created_at';

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(CUSTOMER_COMMS_WRITE_ROLES);
  if (deny) return deny;

  const { data: parent } = await admin.from('customers').select('id').eq('id', id).is('deleted_at', null).maybeSingle();
  if (!parent) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

  const b = await req.json().catch(() => null) as {
    note?: string; due_date?: string; assignee_id?: string | null;
    lead_intake_id?: string | null; project_id?: string | null;
  } | null;

  const note = b?.note?.trim();
  if (!note) return NextResponse.json({ error: 'Note is required' }, { status: 400 });
  if (!b?.due_date) return NextResponse.json({ error: 'Due date is required' }, { status: 400 });
  if (Number.isNaN(new Date(b.due_date).getTime())) return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });

  const { data, error } = await admin.from('customer_follow_ups').insert({
    customer_id: id,
    lead_intake_id: b?.lead_intake_id || null,
    project_id: b?.project_id || null,
    note,
    due_date: b.due_date,
    assignee_id: b?.assignee_id || null,
    status: 'open',
    created_by: user.id,
  }).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({ actorId: user.id, action: 'customer_follow_up.created', resource: `customer_follow_up:${data.id}`, newValue: { customer_id: id, due_date: b.due_date } });
  return NextResponse.json({ followUp: data }, { status: 201 });
}
