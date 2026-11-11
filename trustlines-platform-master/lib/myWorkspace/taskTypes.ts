// My Tasks rows and the client-safe helpers around them (lib/myWorkspace/tasks.ts loads them).

export type MyTaskStatus = 'todo' | 'in_progress' | 'done';
export type MyTaskSource = 'sales' | 'marketing' | 'customers';

export interface MyTask {
  id: string;
  source: MyTaskSource;
  title: string;
  status: MyTaskStatus;
  /** YYYY-MM-DD, or null. */
  dueDate: string | null;
  completedAt: string | null;
  /** The deal, customer or project the task belongs to. */
  record: { label: string; href: string };
  project: { id: string; code: string } | null;
  /**
   * Where a status change is sent, or null when this person can't change it.
   * 'lead' APIs take POST { status: todo | in_progress | done };
   * 'follow_up' takes PATCH { status: open | done }.
   */
  statusApi: { kind: 'lead' | 'follow_up'; url: string } | null;
}

export const SOURCE_LABEL: Record<MyTaskSource, string> = { sales: 'Sales', marketing: 'Marketing', customers: 'Customers' };

/** Local day, YYYY-MM-DD. */
export function todayKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export const isOpen = (t: Pick<MyTask, 'status'>) => t.status !== 'done';
export const isOverdue = (t: Pick<MyTask, 'status' | 'dueDate'>, today: string) => isOpen(t) && !!t.dueDate && t.dueDate < today;

/** Open tasks, overdue first, then by due date (no date last). */
export function byUrgency(a: MyTask, b: MyTask): number {
  const ao = isOpen(a) ? 0 : 1, bo = isOpen(b) ? 0 : 1;
  if (ao !== bo) return ao - bo;
  return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
}
