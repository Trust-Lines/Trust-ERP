import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { CampaignFormClient, type CampaignFormValues } from '@/components/platform/marketing/CampaignFormClient';
import type { UserRole } from '@/types/database';

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('page.marketing_campaigns');
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'marketing_pr';
  if (!MARKETING_WRITE_ROLES.includes(userRole)) redirect(`/marketing/campaigns/${id}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: campaign, error } = await sb.from('marketing_campaigns')
    .select('id, name, city, state, start_date, end_date, status, description, survey_template')
    .eq('id', id).is('deleted_at', null).maybeSingle();
  if (error || !campaign) notFound();
  if (campaign.status === 'closed') redirect(`/marketing/campaigns/${id}`);

  const initial: CampaignFormValues = {
    name: campaign.name ?? '', state: campaign.state ?? '', city: campaign.city ?? '',
    startDate: campaign.start_date ?? '', endDate: campaign.end_date ?? '', description: campaign.description ?? '',
    surveyTemplate: (campaign.survey_template ?? 'none') as CampaignFormValues['surveyTemplate'],
  };

  return (
    <div className="main-inner">
      <CampaignFormClient mode="edit" campaignId={id} initial={initial} />
    </div>
  );
}
