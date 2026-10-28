import { notFound } from 'next/navigation';
import { REGIONS } from '@/lib/regions';
import { audienceOptions, emailPageContext } from '@/lib/email/pageContext';
import { EmailCampaignClient } from '@/components/platform/marketing/email/EmailCampaignClient';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EmailCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const ctx = await emailPageContext();
  const options = await audienceOptions(ctx.admin);
  return (
    <div className="main-inner">
      <EmailCampaignClient
        id={id} canEdit={ctx.canEdit} isManager={ctx.isManager} userId={ctx.userId} mailReady={ctx.mailReady}
        marketingCampaigns={options.marketingCampaigns} sources={options.sources}
        regions={REGIONS.map(r => ({ value: r.code, label: r.label }))}
      />
    </div>
  );
}
