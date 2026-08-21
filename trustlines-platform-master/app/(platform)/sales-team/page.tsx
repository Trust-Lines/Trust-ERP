import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SalesTeamClient, type SalesRepRow, type RegionClient } from '@/components/platform/team/SalesTeamClient';
import { SALES_TEAM_ADMIN_ROLES } from '@/lib/sales/roles';

export default async function SalesTeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role ?? '';
  if (!SALES_TEAM_ADMIN_ROLES.includes(role)) redirect('/dashboard');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = createAdminClient() as any;

  const [repsRes, clientsRes, peekRes] = await Promise.all([
    adm.from('profiles')
      .select('id, full_name, email, is_active, sales_region_id')
      .eq('role', 'sales_rep')
      .order('full_name'),
    adm.from('clients')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name'),
    adm.rpc('peek_global_number'),
  ]);

  const reps = (repsRes.data ?? []) as SalesRepRow[];
  const regionClients = (clientsRes.data ?? []) as RegionClient[];
  const nextNumber = (peekRes.data as number) ?? 1;

  return (
    <div className="main-inner">
      <SalesTeamClient reps={reps} regionClients={regionClients} nextNumber={nextNumber} />
    </div>
  );
}
