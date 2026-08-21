import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requirePage } from '@/lib/permissions/requirePage';
import { createAdminClient } from '@/lib/supabase/admin';
import { TrashClient } from '@/components/platform/projects/TrashClient';
import type { UserRole } from '@/types/database';

export default async function TrashPage() {
  await requirePage('page.trash');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profileData } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'ops_manager';

  if (!['ops_manager', 'general_manager'].includes(userRole)) redirect('/projects');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  await admin.from('projects').delete().lt('deleted_at', cutoff);

  const { data: rows } = await admin
    .from('projects')
    .select('id, code, name, current_stage, categories, deleted_at, deal_value, currency')
    .not('deleted_at', 'is', null)
    .gte('deleted_at', cutoff)
    .order('deleted_at', { ascending: false });

  return (
    <TrashClient
      projects={(rows ?? []) as {
        id: string; code: string; name: string;
        current_stage: string; categories: string[];
        deleted_at: string; deal_value: number | null; currency: string;
      }[]}
    />
  );
}
