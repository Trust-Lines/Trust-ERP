import { createClient } from '@/lib/supabase/server';
import { requirePage } from '@/lib/permissions/requirePage';
import { createAdminClient } from '@/lib/supabase/admin';
import { TeamPageClient } from '@/components/platform/team/TeamPageClient';
import { getRolePermissions } from '@/lib/permissions/server';
import { permCan } from '@/lib/permissions/catalog';
import type { UserRole } from '@/types/database';

export default async function TeamPage() {
  await requirePage('page.team');
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: profileData } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'ops_manager';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canEdit = permCan(await getRolePermissions(createAdminClient() as any, userRole), 'edit.team');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = createAdminClient() as any;

  const [profilesRes, clientsRes, franchisesRes, rolesRes, servicesRes] = await Promise.all([
    supabase.from('profiles')
      .select('id, full_name, email, role, is_active, created_at')
      .order('role').order('full_name'),

    adm.from('clients')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name'),

    adm.from('client_franchises')
      .select('id, name, code, client_id')
      .neq('is_active', false)
      .order('name'),

    adm.from('role_definitions')
      .select('name, label, color_bg, color_fg, is_system')
      .order('is_system', { ascending: false })
      .order('label'),

    adm.from('client_companies')
      .select('id, name, client_id')
      .order('name'),
  ]);

  let profiles = (profilesRes.data ?? []) as Record<string, unknown>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pmRes = await (adm as any).from('profiles').select('id, pm_client_id, is_pm_supervisor');
  if (!pmRes.error && pmRes.data) {
    const pmMap = new Map((pmRes.data as { id: string; pm_client_id: string | null; is_pm_supervisor: boolean }[]).map(p => [p.id, p]));
    profiles = profiles.map(p => ({ ...p, ...(pmMap.get(p.id as string) ?? {}) }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metaRes = await (adm as any).from('profiles')
    .select('id, company_side, office, department, skills, manager_id, region_ids, service_line_ids');
  const metadataReady = !metaRes.error;
  if (metadataReady && metaRes.data) {
    const metaMap = new Map((metaRes.data as { id: string }[]).map(p => [p.id, p]));
    profiles = profiles.map(p => ({ ...p, ...(metaMap.get(p.id as string) ?? {}) }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const regionRes = await (adm as any).from('profiles').select('id, assigned_regions');
  if (!regionRes.error && regionRes.data) {
    const regionMap = new Map((regionRes.data as { id: string; assigned_regions: string[] }[]).map(p => [p.id, p.assigned_regions]));
    profiles = profiles.map(p => ({ ...p, assigned_regions: regionMap.get(p.id as string) ?? [] }));
  }

  return (
    <div className="main-inner">
      <TeamPageClient
        canEdit={canEdit}
        profiles={profiles as never}
        clients={clientsRes.data ?? []}
        franchises={franchisesRes.data ?? []}
        roleDefinitions={rolesRes.data ?? []}
        serviceLines={servicesRes.error ? [] : (servicesRes.data ?? [])}
        metadataReady={metadataReady}
        userRole={userRole}
      />
    </div>
  );
}
