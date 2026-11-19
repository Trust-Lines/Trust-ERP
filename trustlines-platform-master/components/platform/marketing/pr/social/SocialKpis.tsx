'use client';

import { CalendarClock, Heart, Send, Users } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { fmtNumber } from '@/components/platform/marketing/pr/shared';
import type { SocialStore } from './useSocialData';

/** Total followers · published this month · scheduled · average engagement (30 days). The last three wait for `today`. */
export function SocialKpis({ kpis, activeAccounts, today }: { kpis: SocialStore['kpis']; activeAccounts: number; today: string | null }) {
  return (
    <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        icon={<Users />} label="Total followers" value={fmtNumber(kpis.latestTotal)}
        trend={kpis.followerTrend !== null ? { value: kpis.followerTrend, context: 'since the previous count' } : undefined}
        badge={kpis.followerTrend === null ? { label: `${activeAccounts} accounts`, tone: 'neutral' } : undefined}
      />
      <KpiCard icon={<Send />} label="Published this month" value={kpis.publishedThisMonth ?? '—'} loading={!today} />
      <KpiCard icon={<CalendarClock />} label="Scheduled" value={kpis.scheduled ?? '—'} loading={!today} href="/marketing/calendar" />
      <KpiCard
        icon={<Heart />} label="Avg. engagement (30 days)" value={kpis.avgRate === null ? '—' : `${kpis.avgRate}%`} loading={!today}
        badge={kpis.avgRate === null && today ? { label: 'Add post results', tone: 'neutral' } : undefined}
      />
    </div>
  );
}
