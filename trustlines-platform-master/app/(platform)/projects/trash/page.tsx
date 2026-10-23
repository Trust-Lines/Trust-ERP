import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requirePage } from '@/lib/permissions/requirePage';
import { createAdminClient } from '@/lib/supabase/admin';
import { TrashClient } from '@/components/platform/projects/TrashClient';
import type { UserRole } from '@/types/database';

export default async function TrashPage() {
  await requirePage('page.trash');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profileData } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'ops_manager';

  if (!['ops_manager', 'general_manager'].includes(userRole)) redirect('/projects');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  await admin.from('projects').delete().lt('deleted_at', cutoff);

  const { data: rows } = await admin
    .from('projects')
    .select('id, code, name, current_stage, categories, deleted_at, deal_value, currency')
    .not('deleted_at', 'is', null)
    .gte('deleted_at', cutoff)
    .order('deleted_at', { ascending: false });

  const trashed = (rows ?? []) as {
    id: string; code: string; name: string;
    current_stage: string; categories: string[];
    deleted_at: string; deal_value: number | null; currency: string;
  }[];

  // projects has no deleted_by column — "Deleted by" comes from the project.deleted audit entry
  // that DELETE /api/projects/[id] already writes (latest one per project wins).
  const deletedBy = new Map<string, string>();
  if (trashed.length > 0) {
    const { data: audits } = await admin
      .from('audit_log')
      .select('project_id, actor_id, created_at')
      .eq('action', 'project.deleted')
      .in('project_id', trashed.map(p => p.id))
      .order('created_at', { ascending: false });
    const latest = new Map<string, string>();
    for (const a of (audits ?? []) as { project_id: string; actor_id: string | null }[]) {
      if (a.actor_id && !latest.has(a.project_id)) latest.set(a.project_id, a.actor_id);
    }
    const actorIds = [...new Set(latest.values())];
    if (actorIds.length > 0) {
      const { data: actors } = await admin.from('profiles').select('id, full_name').in('id', actorIds);
      const names = new Map(((actors ?? []) as { id: string; full_name: string | null }[]).map(p => [p.id, p.full_name ?? '']));
      for (const [projectId, actorId] of latest) {
        const name = names.get(actorId);
        if (name) deletedBy.set(projectId, name);
      }
    }
  }

  return (
    <TrashClient
      projects={trashed.map(p => ({ ...p, deleted_by: deletedBy.get(p.id) ?? null }))}
      purgeDays={30}
    />
  );
}
