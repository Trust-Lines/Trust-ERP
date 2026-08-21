import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { TasksClient, type TaskRow } from '@/components/platform/sales/TasksClient';
import { SALES_INTAKE_ROLES } from '@/lib/sales/roles';

export default async function SalesTasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role ?? '';
  if (!SALES_INTAKE_ROLES.includes(role)) redirect('/dashboard');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = createAdminClient() as any;

  const { data: taskRows } = await adm.from('lead_tasks')
    .select('id, lead_intake_id, title, status, assignee_id, due_date, created_at, completed_at')
    .order('created_at', { ascending: false })
    .limit(500);
  const rawTasks = (taskRows ?? []) as {
    id: string; lead_intake_id: string; title: string; status: TaskRow['status'];
    assignee_id: string | null; due_date: string | null; created_at: string; completed_at: string | null;
  }[];

  const leadIds = [...new Set(rawTasks.map(t => t.lead_intake_id))];
  const [leadsRes, repsRes] = await Promise.all([
    leadIds.length ? adm.from('lead_intake').select('id, customer_name, brand, created_by, deleted_at').in('id', leadIds) : Promise.resolve({ data: [] }),
    adm.from('profiles').select('id, full_name').in('role', ['sales_rep', 'sales_marketing_manager']).eq('is_active', true).order('full_name'),
  ]);
  const leads = (leadsRes.data ?? []) as { id: string; customer_name: string | null; brand: string | null; created_by: string | null; deleted_at: string | null }[];
  const leadById = new Map(leads.map(l => [l.id, l]));
  const assignees = (repsRes.data ?? []) as { id: string; full_name: string }[];
  const nameById = new Map(assignees.map(a => [a.id, a.full_name]));

  const tasks: TaskRow[] = rawTasks
    .map(t => {
      const lead = leadById.get(t.lead_intake_id);
      if (!lead || lead.deleted_at) return null;
      if (role === 'sales_rep' && t.assignee_id !== user.id && lead.created_by !== user.id) return null;
      return {
        id: t.id,
        lead_id: t.lead_intake_id,
        lead_name: lead.customer_name?.trim() || lead.brand?.trim() || 'Untitled lead',
        title: t.title,
        status: t.status,
        assignee_id: t.assignee_id,
        assignee_name: t.assignee_id ? (nameById.get(t.assignee_id) ?? null) : null,
        due_date: t.due_date,
        created_at: t.created_at,
        completed_at: t.completed_at,
      } as TaskRow;
    })
    .filter(Boolean) as TaskRow[];

  return (
    <div className="main-inner">
      <TasksClient tasks={tasks} assignees={assignees} currentUserId={user.id} />
    </div>
  );
}
