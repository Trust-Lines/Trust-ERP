'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/status-badge';
import { HEADING_TEXT } from '@/components/platform/marketing/pr/shared';
import type { EmailCampaignRow } from '@/lib/email/campaigns';

export function CampaignHeading({ campaign, back = true, actions }: { campaign: EmailCampaignRow; back?: boolean; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        {back && <Link href="/marketing/email" className="inline-flex w-fit items-center gap-1 text-[11px] font-semibold text-ui-nav-active hover:underline"><ArrowLeft size={16} /> Email Campaigns</Link>}
        <h1 className={cn('m-0 flex flex-wrap items-center gap-3 text-[28px] font-semibold leading-[1.35]', HEADING_TEXT)}>
          {campaign.name} <StatusBadge group="email_campaign" status={campaign.status} />
        </h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
