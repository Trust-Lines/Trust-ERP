'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { MonthBucket, RegionKey } from './dashboardData';

export interface RegionSeries { key: RegionKey; label: string; color: string; values: number[] }

function niceMax(v: number) { const step = v <= 4 ? 1 : v <= 20 ? 5 : v <= 40 ? 10 : Math.ceil(v / 40) * 10; return Math.max(step * 4, Math.ceil(v / step) * step); }

function Axis({ max, children, months, height = 220 }: { max: number; children: ReactNode; months: MonthBucket[]; height?: number }) {
  const ticks = [0, 1, 2, 3, 4].map(i => (max / 4) * i);
  return (
    <div className="flex gap-3">
      <div className="relative w-8 shrink-0" style={{ height }} aria-hidden>
        {ticks.map(t => <span key={t} className="absolute right-0 translate-y-1/2 text-[12px] font-medium leading-4 text-ui-text-secondary" style={{ bottom: `${(t / max) * 100}%` }}>{Math.round(t)}</span>)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height }}>
          {ticks.map(t => <div key={t} aria-hidden className="absolute inset-x-0 h-px bg-ui-divider opacity-65" style={{ bottom: `${(t / max) * 100}%` }} />)}
          {children}
        </div>
        <div className="mt-2 flex" aria-hidden>
          {months.map(m => <span key={m.key} className="flex-1 text-center text-[12px] font-medium leading-4 text-ui-text-secondary">{m.mon}<br />{m.year}</span>)}
        </div>
      </div>
    </div>
  );
}

export function BarChart({ months, counts }: { months: MonthBucket[]; counts: number[] }) {
  const max = niceMax(Math.max(0, ...counts));
  return (
    <Axis max={max} months={months}>
      <div className="absolute inset-0 flex">
        {months.map((m, i) => (
          <div key={m.key} className="flex flex-1 justify-center">
            <div className="relative h-full w-[min(31px,70%)] bg-ui-divider/50">
              <div className="absolute inset-x-0 bottom-0 rounded-t-[6px] bg-ui-btn-accent" style={{ height: `${(counts[i] / max) * 100}%` }} title={`${m.mon} ${m.year}: ${counts[i]}`} />
            </div>
          </div>
        ))}
      </div>
    </Axis>
  );
}

function smooth(pts: [number, number][]) {
  if (!pts.length) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i]; const mx = (x0 + x1) / 2;
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  return d;
}

export function AreaChart({ months, series }: { months: MonthBucket[]; series: RegionSeries[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...series.flatMap(s => s.values)));
  const W = 1000, H = 220, n = months.length;
  const x = (i: number) => (n < 2 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - (v / max) * H;
  return (
    <Axis max={max} months={months}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <defs>
          {series.map(s => (
            <linearGradient key={s.key} id={`area-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity="0.55" /><stop offset="1" stopColor={s.color} stopOpacity="0.05" />
            </linearGradient>
          ))}
        </defs>
        {series.map(s => {
          const line = smooth(s.values.map((v, i) => [x(i), y(v)]));
          return (
            <g key={s.key}>
              <path d={`${line} L${x(n - 1)},${H} L${x(0)},${H} Z`} fill={`url(#area-${s.key})`} />
              <path d={line} fill="none" stroke={s.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} stroke="var(--ui-text-secondary)" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="absolute inset-0 flex">
        {months.map((m, i) => (
          <div key={m.key} className="relative flex-1" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {hover === i && (
              <div role="tooltip" className={cn('pointer-events-none absolute top-1/3 z-10 w-max min-w-[120px] rounded-[6px] border border-ui-divider bg-ui-surface-elevated px-2.5 py-2 text-[11px] shadow-[0_4px_16px_rgba(0,0,0,0.10)]', i > n / 2 ? 'right-1/2' : 'left-1/2')}>
                <p className="m-0 font-medium text-ui-heading">{m.mon} {m.year}</p>
                {series.map(s => (
                  <p key={s.key} className="m-0 mt-1 flex items-center justify-between gap-4 text-ui-text-secondary">
                    <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full" style={{ background: s.color }} />{s.key}</span>
                    <span className="font-semibold text-ui-heading tabular-nums">{s.values[i]}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Axis>
  );
}
