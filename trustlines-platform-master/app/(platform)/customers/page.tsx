import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CustomersPageClient } from '@/components/platform/customers/CustomersPageClient';
import { requirePage } from '@/lib/permissions/requirePage';
import { getRolePermissions } from '@/lib/permissions/server';
import { permCan } from '@/lib/permissions/catalog';
import type { UserRole } from '@/types/database';

export default async function CustomersPage() {
  await requirePage('page.customers');
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'ops_manager';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canEdit = permCan(await getRolePermissions(createAdminClient() as any, userRole), 'edit.customers');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const res = await sb.from('customers')
    .select('id, name, code, industry, email, phone, status, is_archived, created_at')
    .is('deleted_at', null).eq('is_archived', false).order('name').limit(500);
  const customers = res.error ? [] : (res.data ?? []);

  return (
    <div className="main-inner">
      <CustomersPageClient initialCustomers={customers} canEdit={canEdit} />
    </div>
  );
}
