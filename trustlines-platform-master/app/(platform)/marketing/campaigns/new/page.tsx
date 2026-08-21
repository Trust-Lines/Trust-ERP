import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { CampaignFormClient, EMPTY_CAMPAIGN_FORM } from '@/components/platform/marketing/CampaignFormClient';
import type { UserRole } from '@/types/database';

export default async function NewCampaignPage() {
  await requirePage('page.marketing_campaigns');
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'marketing_pr';
  if (!MARKETING_WRITE_ROLES.includes(userRole)) redirect('/marketing/campaigns');

  return (
    <div className="main-inner">
      <CampaignFormClient mode="create" initial={EMPTY_CAMPAIGN_FORM} />
    </div>
  );
}
