import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { CALENDAR_COLS, parseCalendarEntry } from '@/lib/marketing/prWorkspace';
import { canDelete, dbError } from '@/lib/marketing/prWorkspaceServer';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  const { data: current, error: readError } = await admin.from('marketing_calendar_entries')
    .select('starts_on, ends_on, start_time, end_time').eq('id', id).is('deleted_at', null).maybeSingle();
  if (readError) return dbError('save the entry', readError);
  if (!current) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

  // Postgres returns TIME as HH:MM:SS — compare on HH:MM like the form sends.
  const stored = { ...current, start_time: current.start_time?.slice(0, 5) ?? null, end_time: current.end_time?.slice(0, 5) ?? null };
  const parsed = parseCalendarEntry(await req.json().catch(() => null), true, stored);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (Object.keys(parsed.value).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('marketing_calendar_entries').update(parsed.value).eq('id', id).select(CALENDAR_COLS).single();
  if (error) return dbError('save the entry', error);

  await logAudit({ actorId: user.id, action: 'calendar_entry.updated', resource: `calendar_entry:${id}`, newValue: parsed.value });
  return NextResponse.json({ entry: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  const { data: row, error: readError } = await admin.from('marketing_calendar_entries')
    .select('id, title, created_by').eq('id', id).is('deleted_at', null).maybeSingle();
  if (readError) return dbError('delete the entry', readError);
  if (!row) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  if (!canDelete(role, user.id, row.created_by)) {
    return NextResponse.json({ error: 'Only the person who added this entry or a Marketing manager can delete it' }, { status: 403 });
  }

  const { error } = await admin.from('marketing_calendar_entries').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return dbError('delete the entry', error);

  await logAudit({ actorId: user.id, action: 'calendar_entry.deleted', resource: `calendar_entry:${id}`, newValue: { title: row.title } });
  return NextResponse.json({ ok: true });
}
