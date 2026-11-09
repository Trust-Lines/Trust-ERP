'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ChartNoAxesCombined, MessagesSquare, Package2, Plus } from 'lucide-react';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HrCalendar } from './HrCalendar';
import { HrActionButton, HrAgendaCard } from './HrCards';
import { byDate, localAgenda, useHrContainers, useHrLocal } from './HrData';
import { CreateEventDialog, NewOrderDialog } from './HrForms';
import { KIND_TONE, daysLeftLabel, daysUntil, parseDay } from './tones';

// The HR group's other pages (sidebar "Human Resources (HR)"). Same page heading as the board.

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';

export function HrPageHeader({ title, href, subtitle, actions }: { title: string; href: string; subtitle: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'Human Resources', href: '/hr' }, { label: title, href }]} />
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>{title}</h1>
        <p className="m-0 text-[13px] text-ui-body">{subtitle}</p>
      </div>
      {actions}
    </div>
  );
}

function Page({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-6">{children}</div>;
}

// ── Calendar ───────────────────────────────────────────────────────────────────────────────
export function HrCalendarPage() {
  const [today] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [open, setOpen] = useState(false);
  const containers = useHrContainers(today);
  const local = useHrLocal();

  return (
    <Page>
      <HrPageHeader title="Calendar" href="/hr/calendar" subtitle="Deliveries, containers, birthdays, days off and holidays in one month view." />
      {containers.error && (
        <p role="alert" className="m-0 rounded-[8px] px-4 py-3 text-[13px]" style={{ background: 'var(--status-t10-bg)', color: 'var(--status-t10-fg)' }}>{containers.error}</p>
      )}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <HrCalendar
          month={month}
          onMonthChange={setMonth}
          events={[...containers.events, ...local.events]}
          today={today}
          createEvent={{ onClick: () => setOpen(true) }}
          loading={containers.loading}
        />
        <div className="w-full xl:w-[385px] xl:shrink-0">
          <HrAgendaCard today={today} items={[...localAgenda(local.events, today), ...containers.agenda]} loading={containers.loading} />
        </div>
      </div>
      <CreateEventDialog open={open} onOpenChange={setOpen} defaultDate={today} onCreate={local.addEvent} />
    </Page>
  );
}

// ── Orders ("View All" on the board) ───────────────────────────────────────────────────────
export function HrOrdersPage() {
  const [today] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const local = useHrLocal();
  const orders = useMemo(() => [...local.orders].sort(byDate), [local.orders]);
  const tone = KIND_TONE.delivery;
  const newOrder = (
    <HrActionButton action={{ onClick: () => setOpen(true) }} className="gap-[7px] pl-2 pr-3" style={{ background: tone.fg, color: tone.bg }}>
      <Plus size={16} aria-hidden />New Order
    </HrActionButton>
  );

  return (
    <Page>
      <HrPageHeader title="Orders" href="/hr/orders" subtitle="Every order with its delivery date." actions={newOrder} />
      <section aria-label="Orders" className="overflow-hidden rounded-[8px] border border-ui-divider bg-ui-surface-elevated">
        {orders.length === 0 ? (
          <EmptyState icon={<Package2 />} title="No orders yet" description="Orders you add show here with their delivery date." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-ui-divider text-[12px] text-ui-text-secondary">
                  <th scope="col" className="px-5 py-3 font-medium">Item</th>
                  <th scope="col" className="px-5 py-3 font-medium">Reference</th>
                  <th scope="col" className="px-5 py-3 font-medium">Delivery</th>
                  <th scope="col" className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const days = daysUntil(o.dueDate, today);
                  return (
                    <tr key={o.id} className="border-b border-ui-divider last:border-b-0">
                      <td className="px-5 py-3 font-semibold text-ui-heading">{o.name}</td>
                      <td className="px-5 py-3 text-ui-body">{o.reference ?? '—'}</td>
                      <td className="px-5 py-3 text-ui-body">{parseDay(o.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex h-[22px] items-center rounded-[4px] px-2.5 text-[12px]" style={{ background: tone.bg, color: tone.fg }}>{daysLeftLabel(days)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <NewOrderDialog open={open} onOpenChange={setOpen} onCreate={local.addOrder} />
    </Page>
  );
}

// ── Messages ───────────────────────────────────────────────────────────────────────────────
export function HrMessagesPage() {
  return (
    <Page>
      <HrPageHeader title="Messages" href="/hr/messages" subtitle="Conversations with the team about leave, onboarding and requests." />
      <section aria-label="Messages" className="grid min-h-[480px] grid-cols-1 overflow-hidden rounded-[8px] border border-ui-divider bg-ui-surface-elevated md:grid-cols-[300px_1fr]">
        <div className="flex flex-col border-b border-ui-divider md:border-b-0 md:border-r">
          <p className="m-0 border-b border-ui-divider px-5 py-4 text-[14px] font-semibold text-ui-heading">Inbox</p>
          <EmptyState size="sm" className="px-5" title="No conversations yet." />
        </div>
        <EmptyState
          icon={<MessagesSquare />}
          title="No conversation selected"
          description="Messages from the team will show here once HR messaging is connected."
          action={<Button disabled>New message</Button>}
        />
      </section>
    </Page>
  );
}

// ── Reports ────────────────────────────────────────────────────────────────────────────────
const REPORTS = [
  { title: 'Attendance', description: 'Days present, absent and late per person.' },
  { title: 'Leave', description: 'Sick days and vacation taken and remaining.' },
  { title: 'Headcount', description: 'Staff by team and role over time.' },
];

export function HrReportsPage() {
  return (
    <Page>
      <HrPageHeader title="Reports" href="/hr/reports" subtitle="Attendance, leave and headcount at a glance." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {REPORTS.map(r => (
          <section key={r.title} aria-label={r.title} className="flex flex-col gap-4 rounded-[8px] border border-ui-divider bg-ui-surface-elevated p-5">
            <header className={cn('flex items-center gap-2', HEADING)}>
              <ChartNoAxesCombined size={22} strokeWidth={1.5} aria-hidden />
              <h2 className="m-0 text-[18px] font-semibold">{r.title}</h2>
            </header>
            <p className="m-0 text-[13px] text-ui-body">{r.description}</p>
            <EmptyState size="sm" title="No data yet." description="Shows once HR records are connected." />
          </section>
        ))}
      </div>
    </Page>
  );
}
