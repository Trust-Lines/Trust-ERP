import { createClient } from '@/lib/supabase/server';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_WRITE_ROLES, MARKETING_SEE_ALL_ROLES } from '@/lib/marketing/roles';
import { publicSurveyUrl } from '@/lib/marketing/campaigns';
import { CampaignsPageClient, type CampaignRow } from '@/components/platform/marketing/CampaignsPageClient';
import type { UserRole } from '@/types/database';

export default async function CampaignsListPage() {
  await requirePage('page.marketing_campaigns');
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'marketing_pr';
  const canEdit = MARKETING_WRITE_ROLES.includes(userRole);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const res = await sb.from('marketing_campaigns')
    .select('id, name, code, slug, campaign_type, source, city, state, country, start_date, end_date, status, owner_user_id, created_at')
    .is('deleted_at', null).order('created_at', { ascending: false }).limit(200);
  const rows = (res.error ? [] : (res.data ?? [])) as Omit<CampaignRow, 'submission_count' | 'owner_name' | 'publicUrl'>[];

  const ids = rows.map(r => r.id);
  const submissionCountById: Record<string, number> = {};
  let nameById: Record<string, string> = {};
  if (ids.length) {
    const [{ data: submissions }, ownerIds] = await Promise.all([
      sb.from('survey_submissions').select('campaign_id').in('campaign_id', ids).limit(5000),
      Promise.resolve([...new Set(rows.map(r => r.owner_user_id).filter(Boolean))] as string[]),
    ]);
    for (const s of (submissions ?? []) as { campaign_id: string }[]) {
      submissionCountById[s.campaign_id] = (submissionCountById[s.campaign_id] ?? 0) + 1;
    }
    if (ownerIds.length) {
      const { data: people } = await sb.from('profiles').select('id, full_name').in('id', ownerIds);
      nameById = Object.fromEntries(((people ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]));
    }
  }

  const campaigns: CampaignRow[] = rows.map(r => ({
    ...r,
    submission_count: submissionCountById[r.id] ?? 0,
    owner_name: nameById[r.owner_user_id ?? ''] ?? null,
    publicUrl: publicSurveyUrl(r.slug),
  }));

  return (
    <div className="main-inner">
      <CampaignsPageClient
        initialCampaigns={campaigns} canEdit={canEdit} loadError={!!res.error}
        canSeeAll={MARKETING_SEE_ALL_ROLES.includes(userRole)}
      />
    </div>
  );
}
