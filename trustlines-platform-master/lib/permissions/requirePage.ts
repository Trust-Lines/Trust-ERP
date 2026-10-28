import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRolePermissions } from './server';
import { pageAllowed } from './catalog';

export async function requirePage(permKey: string): Promise<void> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).single() as { data: { role: string } | null };
  const role = data?.role ?? null;
  const perms = await getRolePermissions(admin, role);
  // pageAllowed: a page a role hasn't set yet follows its parent / old default (catalog.ts).
  if (!pageAllowed(role, perms, permKey)) redirect('/dashboard');
}
