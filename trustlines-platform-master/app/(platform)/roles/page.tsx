import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RolesPageClient } from '@/components/platform/roles/RolesPageClient';
import { requirePage } from '@/lib/permissions/requirePage';
import type { RoleDefinition } from '@/components/platform/roles/RolesPageClient';

export default async function RolesPage() {
  await requirePage('page.roles');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: roles } = await admin
    .from('role_definitions')
    .select('*')
    .order('is_system', { ascending: false })
    .order('created_at');

  return <RolesPageClient initialRoles={(roles ?? []) as RoleDefinition[]} />;
}
