import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SalesDesk } from '@/components/platform/sales/SalesDesk';
import { loadSalesDashboard } from '@/lib/sales/dashboardData';

const DASH_ROLES = ['sales_marketing_manager', 'ops_manager', 'general_manager'];

export default async function SalesDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role ?? '';
  if (!DASH_ROLES.includes(role)) redirect('/dashboard');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = createAdminClient() as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await loadSalesDashboard(supabase as any, adm);

  return (
    <div style={{ padding: '24px 32px' }}>
      <SalesDesk data={data} />
    </div>
  );
}
