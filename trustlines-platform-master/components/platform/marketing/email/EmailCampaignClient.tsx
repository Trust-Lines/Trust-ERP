'use client';

import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/ui/feedback-states';
import { PANEL } from '@/components/platform/marketing/pr/shared';
import { isEditable, type CampaignClientProps } from './campaign/campaignData';
import { useCampaignDetail } from './campaign/useCampaignDetail';
import { CampaignEditor } from './campaign/CampaignEditor';
import { CampaignReport } from './campaign/CampaignReport';

/** One email campaign: the editor while it's still a draft/scheduled, the report once sending started. */
export function EmailCampaignClient(props: CampaignClientProps) {
  const { detail, error, page, setPage, filter, setFilter, load } = useCampaignDetail(props.id);

  if (error && !detail) return <div className={cn(PANEL, 'p-6')}><ErrorState title="Campaign not available" description={error} /></div>;
  if (!detail) return <p className="text-[13px] text-ui-text-secondary">Loading…</p>;

  return isEditable(detail.campaign)
    ? <CampaignEditor {...props} campaign={detail.campaign} onChanged={load} />
    : <CampaignReport {...props} detail={detail} page={page} setPage={setPage} filter={filter} setFilter={setFilter} onChanged={load} />;
}
