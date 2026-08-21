import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ClientsPageClient } from '@/components/platform/clients/ClientsPageClient';
import { requirePage } from '@/lib/permissions/requirePage';
import { getRolePermissions } from '@/lib/permissions/server';
import { permCan } from '@/lib/permissions/catalog';
import type { UserRole } from '@/types/database';

export default async function ClientsPage() {
  await requirePage('page.clients');
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'ops_manager';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canEdit = permCan(await getRolePermissions(createAdminClient() as any, userRole), 'edit.clients');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: clientRows } = await sb.from('clients')
    .select('id, name, code, notes, is_active').order('name');

  let companyRows: { id: string; client_id: string | null; name: string; code: string | null; margin_pct: number | null; is_active: boolean }[] = [];
  const compRes = await sb.from('client_companies').select('id, client_id, name, code, margin_pct, is_active');
  if (!compRes.error) companyRows = compRes.data ?? [];

  const clients = (clientRows ?? []).map((c: { id: string }) => ({
    ...c,
    companies: companyRows.filter(co => co.client_id === c.id),
  }));

  return (
    <div className="main-inner">
      <ClientsPageClient
        initialClients={clients}
        userRole={userRole}
        canEdit={canEdit}
      />
    </div>
  );
}
