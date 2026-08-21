import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRolePermissions } from './server';
import { permCan } from './catalog';

export async function requirePage(permKey: string): Promise<void> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).single() as { data: { role: string } | null };
  const perms = await getRolePermissions(admin, data?.role ?? null);
  if (!permCan(perms, permKey)) redirect('/dashboard');
}
