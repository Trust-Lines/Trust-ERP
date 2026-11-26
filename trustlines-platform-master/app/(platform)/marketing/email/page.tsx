import { emailPageContext } from '@/lib/email/pageContext';
import { EmailCampaignsClient } from '@/components/platform/marketing/email/EmailCampaignsClient';
import { SectionTabs } from '@/components/platform/shared/SectionTabs';

export const dynamic = 'force-dynamic';

export default async function EmailCampaignsPage() {
  const ctx = await emailPageContext();
  return (
    <div className="main-inner">
      <SectionTabs group="email" current="/marketing/email" />
      <EmailCampaignsClient canEdit={ctx.canEdit} isManager={ctx.isManager} mailReady={ctx.mailReady} />
    </div>
  );
}
