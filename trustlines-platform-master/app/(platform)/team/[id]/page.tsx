import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { getRolePermissions } from '@/lib/permissions/server';
import { pageAllowed } from '@/lib/permissions/catalog';
import { isOpsRole } from '@/lib/permissions/requestUser';
import { MemberProfileClient, type MemberActivity, type MemberProfile } from '@/components/platform/team/MemberProfileClient';

const UUID = /^[0-9a-f-]{36}$/i;

// Team → a member's profile: photo, role and details, and what they've done in the app (the
// audit log). Open to whoever may open Team; Activity only to roles that may open the Audit Log
// page; the photo can be changed by the ops roles that edit members.
export default async function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('page.team');
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const myRole = (me as { role?: string } | null)?.role ?? null;
  const canSeeActivity = pageAllowed(myRole, await getRolePermissions(admin, myRole), 'page.audit');

  const { data: row } = await admin.from('profiles').select('*').eq('id', id).maybeSingle();
  if (!row) notFound();
  const p = row as Record<string, unknown>;
  const str = (k: string) => (typeof p[k] === 'string' && p[k] ? (p[k] as string) : null);

  const managerId = str('manager_id');
  const [roleRes, managerRes] = await Promise.all([
    admin.from('role_definitions').select('label').eq('name', str('role') ?? '').maybeSingle(),
    managerId ? admin.from('profiles').select('full_name').eq('id', managerId).maybeSingle() : { data: null },
  ]);

  const profile: MemberProfile = {
    id,
    fullName: str('full_name') ?? '',
    email: str('email') ?? '',
    role: str('role') ?? '',
    roleLabel: (roleRes.data as { label?: string } | null)?.label ?? null,
    isActive: p.is_active !== false,
    joinedAt: str('created_at'),
    avatarUrl: str('avatar_path') ? `/api/avatar/${id}?v=${Date.parse(str('avatar_updated_at') ?? '') || 0}` : null,
    department: str('department'),
    office: str('office'),
    companySide: str('company_side'),
    manager: (managerRes.data as { full_name?: string } | null)?.full_name ?? null,
    regions: Array.isArray(p.assigned_regions) ? (p.assigned_regions as string[]) : [],
  };

  let activity: MemberActivity[] | null = null;
  if (canSeeActivity) {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: logs } = await admin.from('audit_log')
      .select('id, project_id, action, resource, created_at')
      .eq('actor_id', id).gte('created_at', since)
      .order('created_at', { ascending: false }).limit(300);
    const rows = (logs ?? []) as { id: string; project_id: string | null; action: string; resource: string | null; created_at: string }[];
    const projectIds = [...new Set(rows.map(l => l.project_id).filter((v): v is string => !!v))];
    const { data: projects } = projectIds.length
      ? await admin.from('projects').select('id, code, name').in('id', projectIds)
      : { data: [] };
    const projectMap = new Map(((projects ?? []) as { id: string; code: string; name: string }[]).map(x => [x.id, x]));
    activity = rows.map(l => ({
      id: l.id, action: l.action, resource: l.resource, at: l.created_at,
      project: l.project_id ? projectMap.get(l.project_id) ?? null : null,
    }));
  }

  return (
    <div style={{ padding: 28 }}>
      <MemberProfileClient profile={profile} activity={activity} canEditPhoto={isOpsRole(myRole)} />
    </div>
  );
}
