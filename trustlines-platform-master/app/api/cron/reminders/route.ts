import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/send';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DueItem { title: string; detail: string; link: string; overdue: boolean }

function reminderEmailHtml(recipientName: string, items: DueItem[]): string {
  const rows = items.map(i => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
        <div style="font-size:14px;font-weight:600;color:#111827;">${i.title}</div>
        <div style="font-size:12px;color:${i.overdue ? '#dc2626' : '#6b7280'};margin-top:2px;">${i.detail}</div>
      </td>
    </tr>`).join('');
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:Inter,Arial,sans-serif;background:#f4f4f5;margin:0;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:#0F2A44;padding:24px 28px;">
      <div style="font-size:18px;font-weight:700;color:white;">Trust-Lines</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-top:2px;">Today's follow-ups</div>
    </div>
    <div style="padding:20px 28px 8px;">
      <p style="margin:0 0 12px;font-size:14px;color:#374151;">Hi ${recipientName}, ${items.length} item${items.length === 1 ? ' needs' : 's need'} your attention:</p>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
    </div>
    <div style="padding:14px 28px;border-top:1px solid #f0f0f0;">
      <p style="margin:0;font-size:11px;color:#9ca3af;">Trust-Lines · This is an automated daily reminder.</p>
    </div>
  </div>
</body>
</html>`.trim();
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient() as any;
  const today = new Date().toISOString().slice(0, 10);

  const byUser = new Map<string, DueItem[]>();
  const add = (userId: string | null, item: DueItem) => {
    if (!userId) return;
    (byUser.get(userId) ?? byUser.set(userId, []).get(userId)!).push(item);
  };

  const { data: leads } = await admin.from('lead_intake')
    .select('id, assignee_id, customer_name, follow_up_date, follow_up_reminded_on')
    .eq('is_delivered', false).not('follow_up_date', 'is', null).lte('follow_up_date', today).limit(500);
  const dueLeads = ((leads ?? []) as any[]).filter(r => r.follow_up_reminded_on !== r.follow_up_date);
  for (const r of dueLeads) {
    add(r.assignee_id, {
      title: r.customer_name || 'A lead', detail: `Follow-up was due ${r.follow_up_date}`,
      link: `/leads/${r.id}`, overdue: r.follow_up_date < today,
    });
  }
  const idsByDate = new Map<string, string[]>();
  for (const r of dueLeads) { const l = idsByDate.get(r.follow_up_date) ?? []; l.push(r.id); idsByDate.set(r.follow_up_date, l); }
  for (const [date, ids] of idsByDate) await admin.from('lead_intake').update({ follow_up_reminded_on: date }).in('id', ids);

  const { data: tasks } = await admin.from('lead_tasks')
    .select('id, title, due_date, assignee_id, lead_intake_id, opportunity_id')
    .neq('status', 'done').not('due_date', 'is', null).lte('due_date', today).limit(500);
  for (const t of (tasks ?? []) as any[]) {
    add(t.assignee_id, {
      title: t.title, detail: `Task due ${t.due_date}`,
      link: t.lead_intake_id ? `/leads/${t.lead_intake_id}` : '/marketing/opportunities',
      overdue: t.due_date < today,
    });
  }

  const { data: potentials } = await admin.from('prospect_potentials')
    .select('id, title, target_contact_date, assigned_to, prospect_id')
    .is('deleted_at', null).not('status', 'in', '(converted,lost,cancelled)')
    .not('target_contact_date', 'is', null).lte('target_contact_date', today).limit(500);
  for (const p of (potentials ?? []) as any[]) {
    add(p.assigned_to, {
      title: p.title, detail: `Contact by ${p.target_contact_date}`,
      link: `/marketing/prospects/${p.prospect_id}`, overdue: p.target_contact_date < today,
    });
  }

  if (byUser.size === 0) return NextResponse.json({ recipients: 0, items: 0 });

  const userIds = [...byUser.keys()];
  const { data: people } = await admin.from('profiles').select('id, full_name, email').in('id', userIds);
  const peopleById = new Map(((people ?? []) as any[]).map(p => [p.id, p]));

  let totalItems = 0;
  const notifRows: Record<string, unknown>[] = [];
  for (const [userId, items] of byUser) {
    const person = peopleById.get(userId);
    if (!person) continue;
    totalItems += items.length;

    for (const item of items) {
      notifRows.push({
        user_id: userId, project_id: null, type: 'reminder.daily',
        title: item.overdue ? 'Overdue' : 'Due today', body: `${item.title} — ${item.detail}`, link: item.link,
      });
    }
    if (person.email) {
      try {
        await sendEmail(person.email, `Trust-Lines: ${items.length} follow-up${items.length === 1 ? '' : 's'} today`, reminderEmailHtml(person.full_name ?? 'there', items));
      } catch (e) {
        console.error('[cron/reminders] email failed for', person.email, e instanceof Error ? e.message : e);
      }
    }
  }
  if (notifRows.length) await admin.from('notifications').insert(notifRows);

  return NextResponse.json({ recipients: byUser.size, items: totalItems });
}
