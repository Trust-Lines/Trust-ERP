import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getVerifiedUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRolePermissions } from './server';
import { pageAllowed } from './catalog';

// One profile-role read per request, however many guards run in the same render.
const roleOf = cache(async (userId: string): Promise<string | null> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data } = await admin.from('profiles').select('role').eq('id', userId).single() as { data: { role: string } | null };
  return data?.role ?? null;
});

export async function requirePage(permKey: string): Promise<void> {
  const user = await getVerifiedUser();
  if (!user) redirect('/login');

  const role = await roleOf(user.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perms = await getRolePermissions(createAdminClient() as any, role);
  // pageAllowed: a page a role hasn't set yet follows its parent / old default (catalog.ts).
  if (!pageAllowed(role, perms, permKey)) redirect('/dashboard');
}
