import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requirePage } from '@/lib/permissions/requirePage';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuditLogClient } from '@/components/platform/audit/AuditLogClient';
import type { UserRole } from '@/types/database';

export default async function AuditPage() {
  await requirePage('page.audit');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profileData } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'ops_manager';
  if (!['ops_manager', 'general_manager'].includes(userRole)) redirect('/projects');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: logs } = await admin
    .from('audit_log')
    .select('id, project_id, actor_id, action, resource, old_value, new_value, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500);

  const actorIds    = [...new Set((logs ?? []).map((l: { actor_id: string | null }) => l.actor_id).filter(Boolean))] as string[];
  const projectIds  = [...new Set((logs ?? []).map((l: { project_id: string | null }) => l.project_id).filter(Boolean))] as string[];

  const [profilesRes, projectsRes] = await Promise.all([
    actorIds.length > 0
      ? admin.from('profiles').select('id, full_name').in('id', actorIds)
      : Promise.resolve({ data: [] }),
    projectIds.length > 0
      ? admin.from('projects').select('id, name, code').in('id', projectIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = new Map(
    ((profilesRes.data ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name])
  );
  const projectMap = new Map(
    ((projectsRes.data ?? []) as { id: string; name: string; code: string }[]).map(p => [p.id, p])
  );

  const enriched = (logs ?? []).map((l: {
    id: string; project_id: string | null; actor_id: string | null;
    action: string; resource: string | null;
    old_value: unknown; new_value: unknown; created_at: string;
  }) => ({
    ...l,
    actorName:   l.actor_id ? (profileMap.get(l.actor_id) ?? 'Unknown') : 'System',
    projectName: l.project_id ? (projectMap.get(l.project_id)?.name ?? null) : null,
    projectCode: l.project_id ? (projectMap.get(l.project_id)?.code ?? null) : null,
  }));

  return (
    <AuditLogClient logs={enriched} />
  );
}
