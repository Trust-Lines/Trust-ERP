import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SALES_INTAKE_ROLES } from '@/lib/sales/roles';














export default async function NewLeadFormPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role ?? '';
  if (!SALES_INTAKE_ROLES.includes(role)) redirect('/dashboard');





  const regionRes = await supabase.from('profiles').select('assigned_regions').eq('id', user.id).maybeSingle();
  const assignedRegions = (regionRes.data as { assigned_regions?: string[] } | null)?.assigned_regions ?? [];
  const defaultRegion = assignedRegions.length === 1 ? assignedRegions[0] : null;

  const leadId = crypto.randomUUID();




  const qs = new URLSearchParams({ from: 'quick-deal' });
  if (defaultRegion) qs.set('region', defaultRegion);
  redirect(`/leads/${leadId}?${qs.toString()}`);
}
