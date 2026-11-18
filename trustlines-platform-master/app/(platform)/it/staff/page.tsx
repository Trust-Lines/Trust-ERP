import { redirect } from 'next/navigation';
import { requirePage } from '@/lib/permissions/requirePage';
import { createClient } from '@/lib/supabase/server';
import { ItStaffClient, type ItStaffRow } from '@/components/platform/it/ItStaffClient';
import { itContext, loadStaffItems } from '@/lib/it/server';

// IT → Staff Members (Figma 879:13180). Same profiles read as HR → Staff Members, through the
// user's own session (RLS), gated by the IT page switch. Location and items come from the IT items
// each person holds (it_items, migration 155).
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
  const ctx = await itContext();
  const held = ctx ? await loadStaffItems(ctx) : new Map<string, { location: string | null; items: { id: string; label: string; isSet: boolean }[] }>();
  const staff = ((rows ?? []) as ItStaffRow[]).map(r => ({ ...r, location: held.get(r.id)?.location ?? null, items: held.get(r.id)?.items ?? [] }));

  return (
    <ItStaffClient
      staff={staff}
      // POST /api/team/invite only accepts ops_manager / general_manager for any role.
      canInvite={myRole === 'ops_manager' || myRole === 'general_manager'}
    />
  );
}
