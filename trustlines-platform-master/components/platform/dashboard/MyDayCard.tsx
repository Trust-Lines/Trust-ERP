'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sun, Check, ChevronRight } from 'lucide-react';
import type { MyDayData, MyDayItem } from '@/lib/dashboard/myDay';

// Same /api/my-day feed as components/platform/dashboard/MyDay.tsx (signatures waiting on me,
// QC queue, overdue follow-ups, etc. — computed per-role in lib/dashboard/myDay.ts). That
// component renders one card PER section, full width; this one flattens everything into a
// single box so it sits next to Approvals / Active Projects as an equal third tile.
const TONE_DOT: Record<NonNullable<MyDayItem['tone']>, string> = {
  default: 'bg-slate-400',
  warn: 'bg-amber-500',
  danger: 'bg-red-500',
  good: 'bg-blue-500',
};

const MAX_ITEMS = 5;

export function MyDayCard() {
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
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs">
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-sm font-bold text-slate-900">My Day</h2>
        <Sun size={17} className="text-slate-400" />
      </div>

      {loading ? (
        <div className="py-7 text-center text-xs font-medium text-slate-400">Loading…</div>
      ) : error ? (
        <div className="py-7 text-center text-xs font-medium text-red-600">Couldn&apos;t load. Refresh to try again.</div>
      ) : items.length === 0 ? (
        <div className="py-7 flex flex-col items-center justify-center text-center">
          <div className="w-11 h-11 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
            <Check size={18} strokeWidth={2.5} />
          </div>
          <div className="text-xs font-medium text-slate-500">Nothing needs you right now.</div>
        </div>
      ) : (
        <div className="space-y-1">
          {shown.map((item, i) => (
            <Link
              key={i}
              href={item.href}
              className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
            >
              <span className={`size-2 shrink-0 rounded-full ${TONE_DOT[item.tone ?? 'default']}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-slate-900">{item.label}</span>
                <span className="block truncate text-[11px] text-slate-500">{item.sublabel ?? item.section}</span>
              </span>
              <ChevronRight size={14} className="shrink-0 text-slate-300" />
            </Link>
          ))}
          {items.length > MAX_ITEMS && (
            <p className="pt-1 text-center text-[11px] font-medium text-slate-400">
              +{items.length - MAX_ITEMS} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}
