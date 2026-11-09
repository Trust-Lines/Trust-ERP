'use client';

import { useMemo, useState } from 'react';
import { HrBoard } from './HrBoard';
import type { HrBirthday } from './types';
import { byDate, localAgenda, useHrContainers, useHrLocal } from './HrData';
import { AddUnavailableDialog, CreateEventDialog, NewOrderDialog } from './HrForms';
import { dayKey, daysUntil } from './tones';

// HR dashboard (Figma "HR board", 585:3113). Containers are live (GET /api/containers); events,
// orders and unavailable staff come from the HR forms and stay in this tab until HR has a backend.

const UPCOMING = 3;

export function HrDashboardClient() {
  const [today] = useState(() => new Date());
  const containers = useHrContainers(today, UPCOMING);
  const local = useHrLocal();
  const [dialog, setDialog] = useState<'event' | 'order' | 'unavailable' | null>(null);
  const close = (o: boolean) => { if (!o) setDialog(null); };

  const view = useMemo(() => {
    const upcoming = <T extends { dueDate?: string; date?: string }>(rows: T[]) =>
      rows.filter(r => daysUntil(r.dueDate ?? r.date ?? '', today) >= 0).sort(byDate).slice(0, UPCOMING);
    const birthdays: HrBirthday[] = local.events
      .filter(e => e.kind === 'birthday')
      .map(e => ({ id: e.id, name: e.label, role: e.detail ?? null, date: e.date }));
    return {
      events: [...containers.events, ...local.events],
      agenda: [...localAgenda(local.events, today), ...containers.agenda],
      orders: upcoming(local.orders),
      birthdays: upcoming(birthdays),
      // Leave requests (HR › Requests) count as unavailable on the day they're for.
      unavailable: [...local.unavailable, ...local.requests.filter(r => r.status !== 'rejected' && daysUntil(r.endDate, today) >= 0)
        .map(r => ({ id: r.id, userId: r.userId, name: r.name, role: r.role, reason: r.reason, date: daysUntil(r.date, today) < 0 ? dayKey(today) : r.date }))]
        .filter(u => daysUntil(u.date, today) >= 0).sort(byDate).slice(0, UPCOMING),
    };
  }, [containers, local.events, local.orders, local.unavailable, local.requests, today]);

  return (
    <>
      <HrBoard
        today={today}
        events={view.events}
        agenda={view.agenda}
        birthdays={view.birthdays}
        orders={view.orders}
        containers={containers.upcoming}
        unavailable={view.unavailable}
        actions={{
          createEvent: { onClick: () => setDialog('event') },
          viewAllOrders: { href: '/hr/orders' },
          newOrder: { onClick: () => setDialog('order') },
          viewAllContainers: containers.allowed ? { href: '/logistics' } : undefined,
          addUnavailable: { onClick: () => setDialog('unavailable') },
        }}
        loading={containers.loading}
        error={containers.error}
      />
      <CreateEventDialog open={dialog === 'event'} onOpenChange={close} defaultDate={today} onCreate={local.addEvent} />
      <NewOrderDialog open={dialog === 'order'} onOpenChange={close} onCreate={local.addOrder} />
      <AddUnavailableDialog open={dialog === 'unavailable'} onOpenChange={close} defaultDate={today} onCreate={local.addUnavailable} />
    </>
  );
}
