import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Figma KPI tile (TRUST-LINES ERP → "General Manager" 767:14786, same tile as My Workspace
// 714:36443): uppercase label + "+N New" chip, big number with its icon, a sub-line and a
// sparkline. Shared by /dashboard and My Workspace.

const CARD = 'rounded-[16px] border border-ui-divider bg-ui-surface-elevated';

/** Sparkline of real counts (oldest → newest); flat when every value is 0. */
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1, ...values);
  const w = 92, h = 38;
  const pts = values.map((v, i) => [values.length < 2 ? w / 2 : (i / (values.length - 1)) * w, h - 3 - (v / max) * (h - 8)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const id = `spark-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0 overflow-visible">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.45" /><stop offset="1" stopColor={color} stopOpacity="0.04" /></linearGradient></defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** `color` is the tone's text colour, `onColor` the text on a `color` fill (Figma: the tone's own
 *  background), so the "+N New" badge reads as a dark-on-pale chip in dark mode (node 714:36443). */
export function StatTile({ label, value, icon, sub, badge, color, onColor, spark, href }: {
  label: string; value: ReactNode; icon: ReactNode; sub: string; badge?: string; color: string; onColor: string;
  /** Real counts only; omit (or pass []) when there's no series — no sparkline is drawn then. */
  spark?: number[]; href?: string;
}) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="text-[12px] font-medium uppercase leading-[1.5] tracking-[-0.264px]" style={{ color }}>{label}</span>
        {badge && <span className="inline-flex h-[18px] shrink-0 items-center whitespace-nowrap rounded-[4px] px-2 text-[10px] font-medium tracking-[0.4px]" style={{ background: color, color: onColor }}>{badge}</span>}
      </span>
      <span className="flex items-end justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-2">
          <span className="flex items-center gap-1 text-[36px] font-semibold leading-none tracking-[0.72px] [&_svg]:size-[29px]" style={{ color }}>
            <span className="tabular-nums">{value}</span>{icon}
          </span>
          <span className="text-[10px] leading-[1.5] tracking-[-0.22px] opacity-50" style={{ color }}>{sub}</span>
        </span>
        {spark && spark.length > 0 && <Sparkline values={spark} color={color} />}
      </span>
    </>
  );
  const cls = cn(CARD, 'flex min-w-0 flex-col gap-2 py-3.5 pl-4 pr-4 no-underline');
  return href
    ? <Link href={href} className={cn(cls, 'transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] focus-visible:outline-2 focus-visible:outline-ui-focus-ring')}>{body}</Link>
    : <div className={cls}>{body}</div>;
}
