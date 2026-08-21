import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { roleCan } from '@/lib/permissions/server';
import { ProductionClient } from '@/components/platform/production/ProductionClient';

export const dynamic = 'force-dynamic';

export default async function ProductionPage() {
  await requirePage('page.production');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const canEdit = await roleCan(createAdminClient() as any, role, 'edit.production');

  return <ProductionClient canEdit={canEdit} />;
}
