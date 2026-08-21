import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_INTAKE_ROLES } from '@/lib/sales/roles';

export async function POST() {
  const { user, admin, deny } = await requireRole(SALES_INTAKE_ROLES);
  if (deny) return deny;

  const today = new Date().toISOString().slice(0, 10);

  const { data: rows, error } = await admin.from('lead_intake')
    .select('id, customer_name, follow_up_date, follow_up_reminded_on')
    .eq('assignee_id', user.id)
    .eq('is_delivered', false)
    .not('follow_up_date', 'is', null)
    .lte('follow_up_date', today)
    .limit(100);
  if (error) return NextResponse.json({ created: 0 });

  const due = (rows ?? []).filter((r: { follow_up_date: string; follow_up_reminded_on: string | null }) =>
    r.follow_up_reminded_on !== r.follow_up_date);
  if (due.length === 0) return NextResponse.json({ created: 0 });

  const notifs = due.map((r: { id: string; customer_name: string | null; follow_up_date: string }) => ({
    user_id: user.id, project_id: null, type: 'lead.followup',
    title: 'Follow-up due',
    body: `${r.customer_name || 'A lead'} — follow-up was due ${r.follow_up_date}`,
    link: `/leads/${r.id}`,
  }));
  await admin.from('notifications').insert(notifs);

  const idsByDate = new Map<string, string[]>();
  for (const r of due as { id: string; follow_up_date: string }[]) {
    const list = idsByDate.get(r.follow_up_date) ?? [];
    list.push(r.id);
    idsByDate.set(r.follow_up_date, list);
  }
  for (const [date, ids] of idsByDate) {
    await admin.from('lead_intake').update({ follow_up_reminded_on: date }).in('id', ids);
  }

  return NextResponse.json({ created: due.length });
}
