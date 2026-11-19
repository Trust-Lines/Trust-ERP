'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/modal';
import { fmtNumber } from '@/components/platform/marketing/pr/shared';
import type { EmailCampaignRow } from '@/lib/email/campaigns';
import type { CampaignClientProps } from './campaignData';
import { CampaignHeading } from './CampaignHeading';
import { EditorNotices } from './EditorNotices';
import { DetailsSection } from './DetailsSection';
import { AudienceSection } from './AudienceSection';
import { ContentSection } from './ContentSection';
import { SendSection } from './SendSection';
import { useCampaignEditor } from './useCampaignEditor';

/** Draft / scheduled campaign: details, audience, content, test and send. */
export function CampaignEditor({ campaign, canEdit, isManager, userId, mailReady, marketingCampaigns, regions, sources, onChanged }: CampaignClientProps & {
  campaign: EmailCampaignRow; onChanged: () => Promise<void>;
}) {
  const e = useCampaignEditor(campaign, onChanged);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ro = !canEdit || campaign.status === 'scheduled';
  const canDelete = canEdit && (isManager || campaign.created_by === userId);
  const ready = !!e.form.subject.trim() && !!e.form.body_html.trim() && !!e.count?.recipients && mailReady;

  return (
    <div className="flex flex-col gap-[24px]">
      <CampaignHeading
        campaign={campaign}
        actions={canEdit && (
          <>
            {canDelete && <Button variant="ghost-destructive" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete</Button>}
            {!ro && <Button variant="secondary" onClick={() => e.save()}>Save draft</Button>}
          </>
        )}
      />

      <EditorNotices campaign={campaign} canEdit={canEdit} mailReady={mailReady} unscheduling={e.busy === 'unschedule'} onUnschedule={e.unschedule} />

      <fieldset disabled={ro} className="m-0 flex min-w-0 flex-col gap-[24px] border-0 p-0">
        <DetailsSection form={e.form} onChange={e.setF} />
        <AudienceSection
          audience={e.audience}
          onChange={e.setA}
          count={e.count}
          countError={e.countError}
          readOnly={ro}
          marketingCampaigns={marketingCampaigns}
          regions={regions}
          sources={sources}
        />
        <ContentSection form={e.form} onChange={e.setF} templates={e.templates} readOnly={ro} bodyRef={e.bodyRef} onInsertToken={e.insertToken} />
      </fieldset>

      {canEdit && campaign.status !== 'scheduled' && (
        <SendSection
          busy={e.busy}
          mailReady={mailReady}
          ready={ready}
          when={e.when}
          onWhenChange={e.setWhen}
          onTest={e.sendTest}
          onSchedule={e.schedule}
          onSendNow={() => setConfirmSend(true)}
        />
      )}

      <ConfirmModal
        open={confirmSend} onOpenChange={setConfirmSend}
        title={`Send to ${fmtNumber(e.count?.recipients ?? 0)} recipients now?`}
        description={e.form.subject}
        confirmLabel="Send now"
        warning="Emails can’t be recalled once they’re sent."
        onConfirm={e.sendNow}
      />
      <ConfirmModal
        open={confirmDelete} onOpenChange={setConfirmDelete}
        title="Delete this campaign?" description={campaign.name} tone="destructive" confirmLabel="Delete campaign" onConfirm={e.remove}
      />
    </div>
  );
}
