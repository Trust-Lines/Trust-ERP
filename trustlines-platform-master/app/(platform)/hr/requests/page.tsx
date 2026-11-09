import { redirect } from 'next/navigation';
import { requirePage } from '@/lib/permissions/requirePage';
import { createClient } from '@/lib/supabase/server';
import { HrRequestsClient, type HrRequestPerson } from '@/components/platform/hr/HrRequestsClient';

// Figma "Requests" (node 565:15743). The people a request can be for are the real team (profiles,
// read through the user's own session); the requests themselves have no backend yet.
export default async function HrRequestsPage() {
  await requirePage('page.team');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase.from('profiles')
    .select('id, full_name, role, created_at')
    .eq('is_active', true)
    .not('full_name', 'is', null)
    .order('full_name')
    .limit(1000);

  return <HrRequestsClient people={(data ?? []) as HrRequestPerson[]} />;
}
