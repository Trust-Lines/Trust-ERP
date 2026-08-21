
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runPmFollowupReminders(admin: any, userId: string): Promise<number> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: rows, error } = await admin.from('customer_follow_ups')
      .select('id, customer_id, project_id, note, due_date, reminded_on')
      .eq('assignee_id', userId)
      .eq('status', 'open')
      .not('due_date', 'is', null)
      .lte('due_date', today)
      .limit(100);
    if (error) return 0;

    const due = (rows ?? []).filter((r: { due_date: string; reminded_on: string | null }) => r.reminded_on !== r.due_date);
    if (due.length === 0) return 0;

    const notifs = due.map((r: { id: string; customer_id: string | null; project_id: string | null; note: string | null; due_date: string }) => ({
      user_id: userId,
      project_id: r.project_id ?? null,
      type: 'customer.followup',
      title: 'Follow-up due',
      body: `${r.note ? r.note.slice(0, 80) : 'A customer follow-up'} — due ${r.due_date}`,
      link: r.project_id ? `/projects/${r.project_id}/finalization` : (r.customer_id ? `/customers/${r.customer_id}` : '/notifications'),
    }));
    await admin.from('notifications').insert(notifs);

    const idsByDate = new Map<string, string[]>();
    for (const r of due as { id: string; due_date: string }[]) {
      const list = idsByDate.get(r.due_date) ?? [];
      list.push(r.id);
      idsByDate.set(r.due_date, list);
    }
    for (const [date, ids] of idsByDate) {
      await admin.from('customer_follow_ups').update({ reminded_on: date }).in('id', ids);
    }
    return due.length;
  } catch {
    return 0;
  }
}
