'use client';

import { CalendarClock, CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fmtNumber } from '@/components/platform/marketing/pr/shared';
import type { EmailCampaignRow } from '@/lib/email/campaigns';
import { WHEN } from './campaignData';

/** Scheduled banner, last send error, and the "connect your mailbox" note. */
export function EditorNotices({ campaign, canEdit, mailReady, unscheduling, onUnschedule }: {
  campaign: EmailCampaignRow;
  canEdit: boolean;
  mailReady: boolean;
  unscheduling: boolean;
  onUnschedule: () => void;
}) {
  return (
    <>
      {campaign.status === 'scheduled' && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] bg-info-light px-3 py-2.5 text-[12px] text-info-dark">
          <span><CalendarClock className="mr-1 inline size-5 align-text-bottom" /> Scheduled for {campaign.scheduled_at ? WHEN.format(new Date(campaign.scheduled_at)) : '—'} to {fmtNumber(campaign.recipient_count)} recipients. Unschedule it to make changes.</span>
          {canEdit && <Button size="sm" variant="secondary" loading={unscheduling} onClick={onUnschedule}>Unschedule</Button>}
        </div>
      )}
      {campaign.last_error && (
        <div role="alert" className="flex items-start gap-2 rounded-[6px] bg-error-light px-3 py-2.5 text-[12px] text-error-dark"><CircleAlert className="mt-px size-5 shrink-0" /> {campaign.last_error}</div>
      )}
      {!mailReady && canEdit && (
        <div role="note" className="rounded-[6px] bg-warning-light px-3 py-2.5 text-[12px] text-warning-dark">
          Connect your mailbox in <a href="/settings" className="font-semibold underline">Settings → Email sending</a> to send this campaign.
        </div>
      )}
    </>
  );
}
