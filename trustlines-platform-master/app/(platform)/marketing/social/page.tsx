import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_MANAGE_ROLES, MARKETING_READ_ROLES, MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { loadCampaignOptions, loadSocialData, PrWorkspaceNotReady } from '@/lib/marketing/prWorkspaceServer';
import { SocialMediaClient } from '@/components/platform/marketing/pr/SocialMediaClient';
import type { UserRole } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function SocialMediaPage({ searchParams }: { searchParams: Promise<{ post?: string }> }) {
  await requirePage('page.marketing');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'marketing_pr';
  if (!MARKETING_READ_ROLES.includes(userRole)) redirect('/marketing');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  let initial: Awaited<ReturnType<typeof loadSocialData>> | null = null;
  let campaigns: Awaited<ReturnType<typeof loadCampaignOptions>> = [];
  let loadError: string | null = null;
  try {
    [initial, campaigns] = await Promise.all([loadSocialData(admin), loadCampaignOptions(admin)]);
  } catch (e) {
    loadError = e instanceof PrWorkspaceNotReady
      ? 'The social media tables aren’t set up yet — migration 127 needs to be applied.'
      : 'Social media data could not be loaded. Please refresh the page.';
  }

  const { post } = await searchParams;
  return (
    <div className="main-inner">
      <SocialMediaClient
        initial={initial} campaigns={campaigns} loadError={loadError} openPostId={post ?? null}
        canEdit={MARKETING_WRITE_ROLES.includes(userRole)} isManager={MARKETING_MANAGE_ROLES.includes(userRole)} userId={user.id}
      />
    </div>
  );
}
