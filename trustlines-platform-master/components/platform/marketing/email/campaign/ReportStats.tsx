'use client';

import { Ban, Eye, MousePointerClick, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KpiCard } from '@/components/ui/kpi-card';
import { PANEL, fmtNumber } from '@/components/platform/marketing/pr/shared';
import { pct, type CampaignStats } from '@/lib/email/campaigns';
import { rateText } from './campaignData';

/** Progress bar (while sending / paused) and the four delivery KPIs. */
export function ReportStats({ stats: s, showProgress }: { stats: CampaignStats; showProgress: boolean }) {
  const sent = Number(s.sent);
  const progress = s.total ? Math.round(((s.total - s.pending) / s.total) * 100) : 0;
  return (
    <>
      {showProgress && (
        <div className={cn(PANEL, 'flex flex-col gap-2 p-4')}>
          <div className="flex justify-between text-[12px]"><span>{fmtNumber(s.total - s.pending)} of {fmtNumber(s.total)} processed</span><span className="tabular-nums">{progress}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-ui-hover-bg" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-[var(--color-secondary-700)] transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={<Send />} label="Delivered" value={fmtNumber(sent)} badge={s.failed ? { label: `${s.failed} failed`, tone: 'error' } : undefined} />
        <KpiCard icon={<Eye />} label="Opened" value={rateText(pct(Number(s.opened), sent))} badge={{ label: `${fmtNumber(Number(s.opened))} people`, tone: 'neutral' }} />
        <KpiCard icon={<MousePointerClick />} label="Clicked" value={rateText(pct(Number(s.clicked), sent))} badge={{ label: `${fmtNumber(Number(s.clicked))} people`, tone: 'neutral' }} />
        <KpiCard icon={<Ban />} label="Unsubscribed" value={fmtNumber(Number(s.unsubscribed))} badge={sent ? { label: rateText(pct(Number(s.unsubscribed), sent)), tone: Number(s.unsubscribed) ? 'warning' : 'neutral' } : undefined} />
      </div>
      <p className="-mt-2 m-0 text-[11px] text-ui-text-secondary">Opens are an estimate: some mail apps block the tracking image, others (Apple Mail) open every email automatically. Clicks are exact.</p>
    </>
  );
}
