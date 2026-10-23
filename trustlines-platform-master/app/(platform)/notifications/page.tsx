import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { NotificationsClient, type NotificationRow } from '@/components/platform/notifications/NotificationsClient';

// How far back the page loads; the client narrows it further (7 / 30 / 90 days).
const HISTORY_DAYS = 90;

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profileData as { role: string } | null)?.role ?? '';

  // RLS "own_notifications" already limits this to the signed-in user's rows.
  const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();
  const { data: rows, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, is_read, created_at, project_id')
    .eq('user_id', user.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) console.error('[notifications] query error:', error.message);

  const list = (rows ?? []) as Omit<NotificationRow, 'project'>[];
  const projectIds = [...new Set(list.map(n => n.project_id).filter(Boolean))] as string[];
  const { data: projects } = projectIds.length > 0
    ? await supabase.from('projects').select('id, code, name').in('id', projectIds)
    : { data: [] as { id: string; code: string; name: string }[] };
  const projectMap = new Map(((projects ?? []) as { id: string; code: string; name: string }[]).map(p => [p.id, p]));

  return (
    <div className="main-inner">
      <NotificationsClient
        userId={user.id}
        role={role}
        loadError={!!error}
        notifications={list.map(n => ({
          ...n,
          project: n.project_id ? (projectMap.get(n.project_id) ?? null) : null,
        }))}
      />
    </div>
  );
}
