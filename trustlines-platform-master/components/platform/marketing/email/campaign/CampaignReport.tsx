'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CircleAlert, Pause, Play, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ConfirmModal } from '@/components/ui/modal';
import { PANEL, fmtNumber, sendJson } from '@/components/platform/marketing/pr/shared';
import { WHEN, previewHtml, type CampaignClientProps, type Detail } from './campaignData';
import { CampaignHeading } from './CampaignHeading';
import { ReportStats } from './ReportStats';
import { LinksTable } from './LinksTable';
import { RecipientsTable } from './RecipientsTable';

/** Sending / paused / sent / cancelled campaign: progress, KPIs, links, recipients, sent content. */
export function CampaignReport({ detail, canEdit, page, setPage, filter, setFilter, onChanged }: CampaignClientProps & {
  detail: Detail; page: number; setPage: (p: number) => void; filter: string; setFilter: (f: string) => void; onChanged: () => Promise<void>;
}) {
  const { campaign: c, stats: s, recipients, recipientTotal, topLinks, sender } = detail;
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  /** Throws on failure so the cancel modal stays open. */
  async function control(action: string) {
    setBusy(action);
    try {
      await sendJson(`/api/marketing/email-campaigns/${c.id}/control`, 'POST', { action });
      toast.success(action === 'pause' ? 'Paused — nothing more goes out until you resume' : action === 'resume' ? 'Resumed' : 'Cancelled');
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update');
      throw e;
    } finally {
      setBusy(null);
    }
  }

  const live = c.status === 'sending' || c.status === 'paused';

  return (
    <div className="flex flex-col gap-[24px]">
      <CampaignHeading
        campaign={c}
        actions={canEdit && (
          <>
            {c.status === 'sending' && <Button variant="secondary" loading={busy === 'pause'} onClick={() => control('pause')}><Pause /> Pause</Button>}
            {c.status === 'paused' && <Button loading={busy === 'resume'} onClick={() => control('resume')}><Play /> Resume</Button>}
            {live && <Button variant="ghost-destructive" onClick={() => setConfirmCancel(true)}><X /> Cancel</Button>}
          </>
        )}
      />
      <p className="-mt-3 m-0 text-[13px] text-ui-body">
        “{c.subject}” · from {sender?.full_name || sender?.email || '—'}
        {mounted && c.started_at ? ` · started ${WHEN.format(new Date(c.started_at))}` : ''}
        {mounted && c.finished_at ? ` · finished ${WHEN.format(new Date(c.finished_at))}` : ''}
      </p>

      {c.last_error && (
        <div role="alert" className="flex items-start gap-2 rounded-[6px] bg-warning-light px-3 py-2.5 text-[12px] text-warning-dark"><CircleAlert className="mt-px size-4 shrink-0" /> {c.last_error}</div>
      )}

      <ReportStats stats={s} showProgress={live} />

      {topLinks.length > 0 && <LinksTable links={topLinks} />}

      <RecipientsTable
        recipients={recipients}
        total={recipientTotal}
        page={page}
        onPageChange={setPage}
        filter={filter}
        onFilterChange={setFilter}
        mounted={mounted}
      />

      <section className={cn(PANEL, 'flex flex-col gap-3 p-6')}>
        <h2 className="m-0 text-[15px] font-semibold text-ui-heading">Content that was sent</h2>
        <iframe title="Sent email" sandbox="allow-popups" srcDoc={previewHtml(c.body_html, c.preheader)} className="h-[480px] w-full rounded-[8px] border border-ui-divider bg-white" />
      </section>

      <ConfirmModal
        open={confirmCancel} onOpenChange={setConfirmCancel}
        title="Cancel this campaign?" description={`${fmtNumber(s.pending)} emails not sent yet will be dropped. What already went out stays in this report.`}
        tone="destructive" confirmLabel="Cancel campaign" onConfirm={() => control('cancel')}
      />
    </div>
  );
}
