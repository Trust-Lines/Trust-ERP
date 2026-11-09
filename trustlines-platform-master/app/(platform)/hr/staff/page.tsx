import { redirect } from 'next/navigation';
import { requirePage } from '@/lib/permissions/requirePage';
import { createClient } from '@/lib/supabase/server';
import { HrStaffClient, type HrStaffRow } from '@/components/platform/hr/HrStaffClient';

// Figma "Staff Members" (node 565:13166). Same people and access as the Team page: profiles read
// through the user's own session (RLS), gated by page.team.
export default async function HrStaffPage() {
  await requirePage('page.team');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: me }, { data: rows }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('profiles')
      .select('id, full_name, email, role, is_active, created_at')
      .order('full_name')
      .limit(1000),
  ]);
  const myRole = (me as { role: string | null } | null)?.role ?? '';

  return (
    <HrStaffClient
      staff={(rows ?? []) as HrStaffRow[]}
      // POST /api/team/invite only accepts ops_manager / general_manager for any role.
      canInvite={myRole === 'ops_manager' || myRole === 'general_manager'}
    />
  );
}
