import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { computeCampaignStats, listRecentSubmissions, publicSurveyUrl, publicSurveyPath } from '@/lib/marketing/campaigns';
import { CampaignDetailClient } from '@/components/platform/marketing/CampaignDetailClient';
import type { UserRole } from '@/types/database';

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage('page.marketing_campaigns');
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'marketing_pr';
  const canEdit = MARKETING_WRITE_ROLES.includes(userRole);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: campaign, error } = await sb.from('marketing_campaigns')
    .select('id, name, code, slug, campaign_type, source, city, state, country, venue, description, start_date, end_date, '
      + 'default_language, owner_user_id, status, public_title, public_description, consent_text_version, survey_template, created_at, closed_at')
    .eq('id', id).is('deleted_at', null).maybeSingle();
  if (error || !campaign) notFound();

  let ownerName: string | null = null;
  if (campaign.owner_user_id) {
    const { data: owner } = await sb.from('profiles').select('full_name').eq('id', campaign.owner_user_id).maybeSingle();
    ownerName = (owner as { full_name?: string } | null)?.full_name ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const [stats, recentSubmissions] = await Promise.all([
    computeCampaignStats(admin, id),
    listRecentSubmissions(admin, id, 50),
  ]);

  return (
    <div className="main-inner">
      <CampaignDetailClient
        campaign={{ ...campaign, publicUrl: publicSurveyUrl(campaign.slug), publicPath: publicSurveyPath(campaign.slug) }}
        ownerName={ownerName}
        canEdit={canEdit}
        stats={stats}
        recentSubmissions={recentSubmissions}
      />
    </div>
  );
}
