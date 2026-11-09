'use client';

import { useMemo } from 'react';
import { CalendarDays, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HrAction, HrCalendarEvent } from './types';
import { KIND_LABEL, KIND_ORDER, KIND_TONE, dayKey, startOfDay } from './tones';
import { HrActionButton } from './HrCards';

// Figma "Pattern surface" (node 555:36138): month grid Mon–Sun, weekends shaded, today badged,
// events as tone chips (public holidays as a marker chip), legend underneath.

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
const MAX_CHIPS = 2;

export interface HrCalendarProps {
  /** First day of the shown month. */
  month: Date;
  onMonthChange: (month: Date) => void;
  events: HrCalendarEvent[];
  today: Date;
  createEvent?: HrAction;
  loading?: boolean;
}

function buildWeeks(month: Date): Date[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - lead);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const weekCount = Math.ceil((lead + daysInMonth) / 7);
  return Array.from({ length: weekCount }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d)));
}

export function HrCalendar({ month, onMonthChange, events, today, createEvent, loading }: HrCalendarProps) {
  const weeks = useMemo(() => buildWeeks(month), [month]);
  const todayKey = dayKey(startOfDay(today));
  const byDay = useMemo(() => {
    const m = new Map<string, HrCalendarEvent[]>();
    for (const e of events) {
      const k = e.date.slice(0, 10);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return m;
  }, [events]);

  return (
    <section
      aria-label="Calendar"
      className="flex min-w-0 flex-1 flex-col gap-[17px] overflow-hidden rounded-[10px] border border-ui-divider bg-ui-surface-elevated pb-6 pt-5"
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-ui-divider px-5 pb-[17px]">
        <h2 className={cn('m-0 flex flex-1 items-center gap-2 text-[20px] font-semibold leading-normal', HEADING)}>
          <CalendarDays size={25} strokeWidth={1.5} aria-hidden />
          Calendar
        </h2>
        <label className={cn('relative flex h-9 items-center rounded-[6px] border border-current bg-ui-input-bg', HEADING)}>
          <span className="sr-only">Month</span>
          <select
            value={month.getMonth()}
            onChange={e => onMonthChange(new Date(month.getFullYear(), Number(e.target.value), 1))}
            className="h-full cursor-pointer appearance-none bg-transparent pl-4 pr-10 text-[13px] font-medium leading-[1.35] text-inherit outline-none focus-visible:ring-2 focus-visible:ring-ui-focus-ring rounded-[6px]"
          >
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <ChevronDown size={16} aria-hidden className="pointer-events-none absolute right-4" />
        </label>
        <HrActionButton
          action={createEvent}
          className="gap-[7px] bg-ui-btn-accent px-3.5 text-ui-btn-accent-fg"
        >
          <Plus size={16} aria-hidden />
          Create event
        </HrActionButton>
      </header>

      <div className="flex flex-col gap-5 px-4">
        <div role="grid" aria-label={`${MONTHS[month.getMonth()]} ${month.getFullYear()}`} aria-busy={loading || undefined} className="flex flex-col overflow-x-auto">
          <div role="row" className="flex min-w-[560px] text-center text-[12px] text-ui-text-secondary">
            {WEEKDAYS.map(d => <span role="columnheader" key={d} className="h-[30px] flex-1">{d}</span>)}
          </div>
          {weeks.map(week => (
            <div role="row" key={dayKey(week[0])} className="flex min-w-[560px]">
              {week.map((day, i) => {
                const key = dayKey(day);
                const inMonth = day.getMonth() === month.getMonth();
                const isToday = key === todayKey;
                const weekend = i >= 5;
                const dayEvents = inMonth ? byDay.get(key) ?? [] : [];
                const shown = dayEvents.slice(0, MAX_CHIPS);
                const extra = dayEvents.length - shown.length;
                return (
                  <div
                    role="gridcell"
                    key={key}
                    aria-current={isToday ? 'date' : undefined}
                    className={cn(
                      'flex h-[88px] min-w-0 flex-1 flex-col items-start gap-1 overflow-hidden border-[0.5px] border-ui-divider p-2',
                      weekend ? 'bg-ui-surface' : 'bg-ui-surface-elevated',
                    )}
                  >
                    {isToday ? (
                      <span className="rounded-[4px] bg-ui-btn-accent px-1 py-px text-[12px] font-semibold text-ui-btn-accent-fg">{day.getDate()}</span>
                    ) : (
                      <span className={cn('text-[12px]', inMonth ? 'text-ui-body' : 'text-[var(--status-t0-bg)]')}>{day.getDate()}</span>
                    )}
                    <div className="mt-[5px] flex w-full flex-col gap-1">
                      {shown.map(ev => {
                        const tone = KIND_TONE[ev.kind];
                        return ev.kind === 'holiday' ? (
                          <span key={ev.id} title={ev.label} className="flex w-full items-center gap-1.5 rounded-[4px] px-[13px] py-0.5 text-[11px]" style={{ background: tone.bg, color: tone.fg }}>
                            <span aria-hidden className="size-1.5 shrink-0 rounded-[3px]" style={{ background: tone.fg }} />
                            <span className="truncate">{ev.label}</span>
                          </span>
                        ) : (
                          <span key={ev.id} title={ev.label} className="block w-full truncate rounded-[3px] px-1 py-[5px] text-[10px] font-medium" style={{ background: tone.bg, color: tone.fg }}>
                            {ev.label}
                          </span>
                        );
                      })}
                      {extra > 0 && <span className="text-[10px] text-ui-text-secondary">+{extra} more</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <ul aria-label="Legend" className="m-0 flex list-none flex-wrap items-center gap-4 p-0">
          {KIND_ORDER.map(kind => {
            const tone = KIND_TONE[kind];
            return (
              <li key={kind} className="flex items-center gap-1.5 rounded-[4px] px-[13px] py-0.5 text-[11px]" style={{ background: tone.bg, color: tone.fg }}>
                <span aria-hidden className="size-1.5 rounded-[3px]" style={{ background: tone.fg }} />
                {KIND_LABEL[kind]}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
