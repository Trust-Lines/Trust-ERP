'use client';

import { useState } from 'react';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { cn } from '@/lib/utils';
import type { HrAction, HrAgendaItem, HrBirthday, HrCalendarEvent, HrContainer, HrOrder, HrUnavailable } from './types';
import { HrCalendar } from './HrCalendar';
import { HrAgendaCard, HrBirthdaysCard, HrContainersCard, HrOrdersCard, HrUnavailableCard } from './HrCards';

// Figma "TRUST-LINES-ERP" → "HR board" (node 555:34497, revised 585:3113; dark mode 565:11504 — same tokens, the
// status/surface variables swap under .dark in globals.css), the "Dashboard content" area only —
// the app shell (sidebar, top bar) already exists. UI only: every list comes in through props,
// an empty list shows its empty state, and a header button shows only when it is wired.

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';

export interface HrBoardProps {
  /** Defaults to now; pass it to keep server and client on the same day. */
  today?: Date;
  /** Month shown first (defaults to today's). */
  initialMonth?: Date;
  /** Called when the person picks another month, so the page can load its events. */
  onMonthChange?: (month: Date) => void;
  events?: HrCalendarEvent[];
  agenda?: HrAgendaItem[];
  birthdays?: HrBirthday[];
  orders?: HrOrder[];
  containers?: HrContainer[];
  unavailable?: HrUnavailable[];
  actions?: {
    createEvent?: HrAction;
    viewAllOrders?: HrAction;
    newOrder?: HrAction;
    viewAllContainers?: HrAction;
    addUnavailable?: HrAction;
  };
  loading?: boolean;
  /** Shown above the board when loading failed. */
  error?: string | null;
  className?: string;
}

export function HrBoard({
  today: todayProp, initialMonth, onMonthChange, events = [], agenda = [], birthdays = [], orders = [],
  containers = [], unavailable = [], actions = {}, loading, error, className,
}: HrBoardProps) {
  const [today] = useState(() => todayProp ?? new Date());
  const [month, setMonth] = useState(() => {
    const base = initialMonth ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const changeMonth = (m: Date) => { setMonth(m); onMonthChange?.(m); };

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'General' }, { label: 'Dashboard', href: '/hr' }]} />
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Dashboard</h1>
        <p className="m-0 text-[13px] text-ui-body">Keep handoffs moving. Clear the blockers before they affect delivery.</p>
      </div>

      {error && (
        <p role="alert" className="m-0 rounded-[8px] px-4 py-3 text-[13px]" style={{ background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' }}>
          {error}
        </p>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
          <HrCalendar
            month={month}
            onMonthChange={changeMonth}
            events={events}
            today={today}
            createEvent={actions.createEvent}
            loading={loading}
          />
          <div className="flex w-full flex-col gap-4 xl:w-[385px] xl:shrink-0">
            <HrAgendaCard today={today} items={agenda} loading={loading} />
            <HrBirthdaysCard today={today} items={birthdays} loading={loading} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <HrOrdersCard today={today} items={orders} loading={loading} viewAll={actions.viewAllOrders} newOrder={actions.newOrder} />
          <HrContainersCard today={today} items={containers} loading={loading} viewAll={actions.viewAllContainers} />
          <HrUnavailableCard today={today} items={unavailable} loading={loading} add={actions.addUnavailable} />
        </div>
      </div>
    </div>
  );
}

export type * from './types';
