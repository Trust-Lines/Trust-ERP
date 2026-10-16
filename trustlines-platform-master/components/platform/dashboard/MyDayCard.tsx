'use client';

import { useEffect, useState } from 'react';
import { BadgeAlert, CircleCheck, ClipboardList, Clock } from 'lucide-react';
import type { MyDayData, MyDayItem } from '@/lib/dashboard/myDay';
import { KpiCard, KpiCardRow } from '@/components/ui/kpi-card';

// Same /api/my-day feed as components/platform/dashboard/MyDay.tsx (signatures waiting on me,
// QC queue, overdue follow-ups, etc. — computed per-role in lib/dashboard/myDay.ts), flattened
// into the wide "Tasks" card from Ahmet's Figma dashboard: count on the left, top items as rows.
const ROW_TONE: Record<NonNullable<MyDayItem['tone']>, 'error' | 'warning' | 'info' | 'neutral'> = {
  danger: 'error',
  warn: 'warning',
  good: 'info',
  default: 'neutral',
};
const ROW_ICON: Record<NonNullable<MyDayItem['tone']>, React.ReactNode> = {
  danger: <BadgeAlert />,
  warn: <BadgeAlert />,
  good: <CircleCheck />,
  default: <Clock />,
};

// The Figma card is 145px high — room for two rows.
const MAX_ITEMS = 2;

export function MyDayCard({ className }: { className?: string }) {
  const [data, setData] = useState<MyDayData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    fetch('/api/my-day')
      .then(res => { if (!res.ok) throw new Error(String(res.status)); return res.json(); })
      .then((json: MyDayData) => { if (live) { setData(json); setError(false); } })
      .catch(() => { if (live) setError(true); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const items = (data?.sections ?? []).flatMap(s => s.items.map(i => ({ ...i, section: s.title })));
  const shown = items.slice(0, MAX_ITEMS);

  return (
    <KpiCard tone="muted" icon={<ClipboardList />} label="My Day" value={items.length} loading={loading} className={className}>
      {loading ? null : error ? (
        <p role="alert" className="my-auto rounded-control bg-primary-600 px-3.5 py-4 text-caption">
          Couldn&apos;t load your day. Refresh to try again.
        </p>
      ) : items.length === 0 ? (
        <p role="status" className="my-auto rounded-control bg-primary-600 px-3.5 py-4 text-caption">
          Nothing needs you right now.
        </p>
      ) : (
        <>
          {shown.map((item, i) => {
            const tone = item.tone ?? 'default';
            return (
              <KpiCardRow
                key={i}
                href={item.href}
                tone={ROW_TONE[tone]}
                icon={ROW_ICON[tone]}
                title={item.label}
                subtitle={item.sublabel ?? item.section}
              />
            );
          })}
          {items.length > MAX_ITEMS && (
            <p className="self-end text-caption text-primary-200">+{items.length - MAX_ITEMS} more</p>
          )}
        </>
      )}
    </KpiCard>
  );
}
