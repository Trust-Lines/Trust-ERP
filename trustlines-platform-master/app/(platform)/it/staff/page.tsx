import { redirect } from 'next/navigation';
import { requirePage } from '@/lib/permissions/requirePage';
import { createClient } from '@/lib/supabase/server';
import { ItStaffClient, type ItStaffRow } from '@/components/platform/it/ItStaffClient';

// IT → Staff Members (Figma 879:13180). Same profiles read as HR → Staff Members, through the
// user's own session (RLS), gated by the IT page switch. Location and the IT items each person holds
// have no data source yet, so they are not loaded here.
export default async function ItStaffPage() {
  await requirePage('page.it');
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
    <ItStaffClient
      staff={(rows ?? []) as ItStaffRow[]}
      // POST /api/team/invite only accepts ops_manager / general_manager for any role.
      canInvite={myRole === 'ops_manager' || myRole === 'general_manager'}
    />
  );
}
