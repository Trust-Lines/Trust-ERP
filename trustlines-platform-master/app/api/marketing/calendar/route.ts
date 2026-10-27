import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_READ_ROLES, MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { CALENDAR_COLS, daysBetween, isIsoDate, isMonth, monthGridRange, parseCalendarEntry } from '@/lib/marketing/prWorkspace';
import { dbError, loadCalendarRange, PrWorkspaceNotReady } from '@/lib/marketing/prWorkspaceServer';

// GET ?month=YYYY-MM (the visible 6-week grid) or ?from=YYYY-MM-DD&to=YYYY-MM-DD.
export async function GET(req: NextRequest) {
  const { admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;

  const url = new URL(req.url);
  const month = url.searchParams.get('month');
  let from = url.searchParams.get('from');
  let to = url.searchParams.get('to');
  if (isMonth(month)) ({ from, to } = monthGridRange(month));
  if (!isIsoDate(from) || !isIsoDate(to) || to < from) return NextResponse.json({ error: 'Pick a valid month or date range' }, { status: 400 });
  if (daysBetween(from, to).length > 366) return NextResponse.json({ error: 'The range can be at most a year' }, { status: 400 });

  try {
    return NextResponse.json({ from, to, ...(await loadCalendarRange(admin, from, to)) });
  } catch (e) {
    if (e instanceof PrWorkspaceNotReady) return NextResponse.json({ error: 'The calendar is not set up yet (migration 127).' }, { status: 503 });
    return NextResponse.json({ error: 'Could not load the calendar' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  const parsed = parseCalendarEntry(await req.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await admin.from('marketing_calendar_entries')
    .insert({ ...parsed.value, created_by: user.id }).select(CALENDAR_COLS).single();
  if (error) return dbError('add the entry', error);

  await logAudit({ actorId: user.id, action: 'calendar_entry.created', resource: `calendar_entry:${data.id}`, newValue: { title: data.title, starts_on: data.starts_on } });
  return NextResponse.json({ entry: data }, { status: 201 });
}
