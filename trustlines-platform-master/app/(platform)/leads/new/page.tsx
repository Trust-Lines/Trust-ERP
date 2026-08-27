import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { IntakeForm } from '@/components/platform/leads/IntakeForm';
import { SALES_INTAKE_ROLES } from '@/lib/sales/roles';

export default async function NewLeadFormPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role ?? '';
  if (!SALES_INTAKE_ROLES.includes(role)) redirect('/dashboard');

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = admin as any;

  const { data: assigneesRes } = await adm
    .from('profiles')
    .select('id, full_name')
    .in('role', ['sales_rep', 'sales_marketing_manager'])
    .eq('is_active', true)
    .order('full_name');

  const assignees = (assigneesRes ?? []) as { id: string; full_name: string }[];
  const leadId = crypto.randomUUID();

  return (
    <IntakeForm intakeId={leadId} assignees={assignees} />
  );
}
