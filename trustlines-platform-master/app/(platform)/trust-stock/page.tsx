import { redirect } from 'next/navigation';
import { requirePage } from '@/lib/permissions/requirePage';
import { createClient } from '@/lib/supabase/server';
import { TrustStockClient } from '@/components/platform/trust-stock/TrustStockClient';

// Figma "Trust Stock" (node 598:22796), in the Operations group. Same access as Management
// (ops_manager / general_manager by default). PF amounts and vendor prices are internal cost data:
// tlines_pm is refused here explicitly, whatever their page permissions say (AGENTS.md §2).
export default async function TrustStockPage() {
  await requirePage('page.management');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (data as { role: string | null } | null)?.role ?? null;
  if (!role || role === 'tlines_pm') redirect('/dashboard');

  return <TrustStockClient />;
}
