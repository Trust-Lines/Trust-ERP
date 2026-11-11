'use client';

import { Fragment, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { Cake, ClipboardList, Package2, Pill, Plus, Ship, TreePalm, UsersRound, type LucideIcon } from 'lucide-react';
import { PersonFace } from '@/components/ui/avatar-directory';
import { cn } from '@/lib/utils';
import type { HrAction, HrAgendaItem, HrBirthday, HrContainer, HrOrder, HrPerson, HrUnavailable } from './types';
import { KIND_TONE, dayKey, daysLeftLabel, daysUntil, parseDay } from './tones';
import { holidaysOn, specialDaysOn } from './holidays';

// Side and bottom cards of the HR board (Figma nodes 555:35712, 555:37098, 560:10777, 560:763, 560:810).

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
/** Rows within this many days get the filled "days left" badge. */
const SOON_DAYS = 7;

export function HrActionButton({ action, className, style, children }: { action?: HrAction; className?: string; style?: CSSProperties; children: ReactNode }) {
  if (!action?.href && !action?.onClick) return null;
  const cls = cn(
    'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-[6px] text-[13px] font-medium leading-normal no-underline transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring',
    className,
  );
  return action.href
    ? <Link href={action.href} className={cls} style={style}>{children}</Link>
    : <button type="button" onClick={action.onClick} className={cn(cls, 'cursor-pointer border-0')} style={style}>{children}</button>;
}

function Card({ title, icon: Icon, bg, color, actions, children, className }: {
  title: string; icon: LucideIcon; bg: string; color: string; actions?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section aria-label={title} className={cn('flex min-w-0 flex-col gap-5 overflow-hidden rounded-[8px] border border-ui-divider pb-[21px] pt-4', className)} style={{ background: bg }}>
      <header className="flex min-h-9 items-center gap-2 border-b border-ui-divider px-5 pb-4" style={{ color }}>
        <Icon size={25} strokeWidth={1.5} aria-hidden className="shrink-0" />
        <h2 className="m-0 min-w-0 flex-1 truncate text-[20px] font-semibold leading-normal tracking-[0.4px]">{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  );
}

function List<T extends { id: string }>({ items, loading, empty, color, render }: {
  items: T[]; loading?: boolean; empty: string; color: string; render: (item: T, index: number) => ReactNode;
}) {
  if (loading) return <p className="m-0 px-4 text-[13px] opacity-75" style={{ color }}>Loading…</p>;
  if (items.length === 0) return <p className="m-0 px-4 text-[13px] opacity-75" style={{ color }}>{empty}</p>;
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0 px-4">
      {items.map((item, i) => (
        <Fragment key={item.id}>
          {i > 0 && <li aria-hidden className="h-px bg-ui-divider" />}
          <li>{render(item, i)}</li>
        </Fragment>
      ))}
    </ul>
  );
}

function DateBlock({ iso }: { iso: string }) {
  const d = parseDay(iso);
  return (
    <span className="flex w-[35px] shrink-0 flex-col items-center text-center leading-none">
      <span className="text-[14px] tracking-[-0.308px]">{d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()}</span>
      <span className="mt-1 text-[24px] font-semibold">{d.getDate()}</span>
    </span>
  );
}

function DaysBadge({ days, bg, fg }: { days: number; bg: string; fg: string }) {
  const soon = days >= 0 && days <= SOON_DAYS;
  return (
    <span
      className="inline-flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-[4px] px-2.5 text-[12px] leading-[1.4]"
      style={soon ? { background: fg, color: bg } : { color: fg }}
    >
      {daysLeftLabel(days)}
    </span>
  );
}

function Face({ person, bg }: { person: HrPerson; bg: string }) {
  const initials = person.name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className="flex size-[35px] shrink-0 items-center justify-center overflow-hidden rounded-[6px] text-[12px] font-semibold text-white" style={{ background: bg }}>
      <PersonFace name={person.name} userId={person.userId} fallback={initials} />
    </span>
  );
}

function Who({ title, subtitle }: { title: string; subtitle?: string | null }) {
  return (
    <span className="flex min-w-0 flex-col leading-normal">
      <span className="truncate text-[14px] font-semibold tracking-[-0.308px]">{title}</span>
      {subtitle && <span className="truncate text-[12px] tracking-[-0.264px] opacity-75">{subtitle}</span>}
    </span>
  );
}

function Row({ lead, end, color }: { lead: ReactNode; end: ReactNode; color: string }) {
  return (
    <div className="flex items-center justify-between gap-3 pr-2" style={{ color }}>
      <span className="flex min-w-0 items-center gap-2.5">{lead}</span>
      <span className="flex shrink-0 items-center justify-end gap-4">{end}</span>
    </div>
  );
}

// ── Today's agenda ─────────────────────────────────────────────────────────────────────────
export function HrAgendaCard({ today, items, loading }: { today: Date; items: HrAgendaItem[]; loading?: boolean }) {
  const heading = `${today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^(\w+)/, '$1,')} · Today`;
  // Today's public holiday (Turkey) leads the list, all day.
  const day = dayKey(today);
  const holidays: HrAgendaItem[] = [
    ...holidaysOn(day).map((title, i): HrAgendaItem => ({ id: `holiday-${i}`, time: null, kind: 'holiday', title, detail: 'Public holiday' })),
    ...specialDaysOn(day).map((title, i): HrAgendaItem => ({ id: `special-${i}`, time: null, kind: 'special', title, detail: 'Special day' })),
  ];
  const all = holidays.length ? [...holidays, ...items] : items;
  return (
    <section aria-label="Today" className="flex min-h-[338px] flex-col gap-5 overflow-hidden rounded-[8px] border border-ui-divider bg-ui-surface py-4">
      <header className={cn('flex items-center gap-2 border-b border-ui-divider px-5 pb-4', HEADING)}>
        <ClipboardList size={25} strokeWidth={1.5} aria-hidden className="shrink-0" />
        <h2 suppressHydrationWarning className="m-0 truncate text-[20px] font-semibold leading-normal tracking-[0.4px]">{heading}</h2>
      </header>
      <List
        items={all}
        loading={loading}
        empty="Nothing scheduled today."
        color="var(--ui-text-secondary)"
        render={item => {
          const tone = KIND_TONE[item.kind];
          return (
            <div
              className="flex h-[41px] items-stretch gap-4"
              style={{
                color: tone.fg,
                backgroundImage: `linear-gradient(90deg, var(--ui-surface) 13.5%, ${tone.bg} 13.9%, ${tone.bg} 66%, var(--ui-surface) 98%)`,
              }}
            >
              <span className="flex w-[31px] shrink-0 flex-col justify-center text-[12px] leading-[1.45]">
                {item.time ?? <><span className="leading-none">All</span><span className="leading-none">Day</span></>}
              </span>
              <span aria-hidden className="w-[3px] shrink-0 rounded-[2px]" style={{ background: tone.fg }} />
              <span className="flex min-w-0 flex-1 flex-col justify-center leading-[1.45]">
                <span className="truncate text-[14px] font-medium">{item.title}</span>
                {item.detail && <span className="truncate text-[12px] opacity-75">{item.detail}</span>}
              </span>
            </div>
          );
        }}
      />
    </section>
  );
}

// ── Birthdays ──────────────────────────────────────────────────────────────────────────────
export function HrBirthdaysCard({ today, items, loading }: { today: Date; items: HrBirthday[]; loading?: boolean }) {
  const tone = KIND_TONE.birthday;
  return (
    <Card title="Birthdays" icon={Cake} bg={tone.bg} color={tone.fg} className="min-h-[256px]">
      <List items={items} loading={loading} empty="No upcoming birthdays." color={tone.fg} render={b => (
        <Row
          color={tone.fg}
          lead={<><Face person={b} bg="var(--ui-selected-bg)" /><Who title={b.name} subtitle={b.role} /></>}
          end={<><DaysBadge days={daysUntil(b.date, today)} bg={tone.bg} fg={tone.fg} /><DateBlock iso={b.date} /></>}
        />
      )} />
    </Card>
  );
}

// ── Orders ─────────────────────────────────────────────────────────────────────────────────
export function HrOrdersCard({ today, items, loading, viewAll, newOrder }: {
  today: Date; items: HrOrder[]; loading?: boolean; viewAll?: HrAction; newOrder?: HrAction;
}) {
  const tone = KIND_TONE.delivery;
  return (
    <Card
      title="Orders" icon={Package2} bg={tone.bg} color={tone.fg}
      actions={<>
        <HrActionButton action={viewAll} className="border border-solid border-current bg-transparent px-2 text-inherit">View All</HrActionButton>
        <HrActionButton action={newOrder} className="gap-[7px] pl-2 pr-3" style={{ background: tone.fg, color: tone.bg }}>
          <Plus size={16} aria-hidden />New Order
        </HrActionButton>
      </>}
    >
      <List items={items} loading={loading} empty="No open orders." color={tone.fg} render={o => (
        <Row
          color={tone.fg}
          lead={<>
            <span className="flex size-[35px] shrink-0 items-center justify-center rounded-[6px]" style={{ background: tone.fg, color: tone.bg }}>
              <Package2 size={21} strokeWidth={1.5} aria-hidden />
            </span>
            <Who title={o.name} subtitle={o.reference} />
          </>}
          end={<><DaysBadge days={daysUntil(o.dueDate, today)} bg={tone.bg} fg={tone.fg} /><DateBlock iso={o.dueDate} /></>}
        />
      )} />
    </Card>
  );
}

// ── Containers ─────────────────────────────────────────────────────────────────────────────
export function HrContainersCard({ today, items, loading, viewAll }: {
  today: Date; items: HrContainer[]; loading?: boolean; viewAll?: HrAction;
}) {
  const tone = KIND_TONE.container;
  return (
    <Card
      title="Containers" icon={Ship} bg={tone.bg} color={tone.fg}
      actions={<HrActionButton action={viewAll} className="border border-solid border-current bg-transparent px-2 text-inherit">View All</HrActionButton>}
    >
      <List items={items} loading={loading} empty="No containers on the way." color={tone.fg} render={c => (
        <Row
          color={tone.fg}
          lead={<>
            <span className="flex size-[35px] shrink-0 items-center justify-center rounded-[6px]" style={{ background: tone.fg, color: tone.bg }}>
              <Ship size={25} strokeWidth={1.5} aria-hidden />
            </span>
            <Who title={c.label} subtitle={c.itemCount != null ? `${c.itemCount} Item${c.itemCount === 1 ? '' : 's'}` : null} />
          </>}
          end={<><DaysBadge days={daysUntil(c.dueDate, today)} bg={tone.bg} fg={tone.fg} /><DateBlock iso={c.dueDate} /></>}
        />
      )} />
    </Card>
  );
}

// ── Unavailable staff ──────────────────────────────────────────────────────────────────────
const REASON: Record<HrUnavailable['reason'], { label: string; icon: LucideIcon; bg: string; fg: string }> = {
  sick: { label: 'Sick', icon: Pill, bg: 'var(--status-t9-bg)', fg: 'var(--status-t9-fg)' },
  vacation: { label: 'Vacation', icon: TreePalm, bg: 'var(--status-t5-bg)', fg: 'var(--status-t5-fg)' },
};

export function HrUnavailableCard({ today, items, loading, add }: {
  today: Date; items: HrUnavailable[]; loading?: boolean; add?: HrAction;
}) {
  const tone = KIND_TONE.absent;
  return (
    <Card
      title="Unavailable Staff" icon={UsersRound} bg="var(--ui-surface)" color={tone.fg}
      actions={<HrActionButton action={add} className="gap-[7px] pl-2.5 pr-3.5 text-ui-surface-elevated" style={{ background: tone.fg }}>
        <Plus size={16} aria-hidden />Add
      </HrActionButton>}
    >
      <List items={items} loading={loading} empty="Everyone is available." color={tone.fg} render={u => {
        const r = REASON[u.reason];
        const Icon = r.icon;
        return (
          <Row
            color={tone.fg}
            lead={<><Face person={u} bg={tone.fg} /><Who title={u.name} subtitle={u.role} /></>}
            end={<>
              <span className="inline-flex h-[22px] items-center gap-1 rounded-[4px] pl-2 pr-2.5 text-[12px] font-medium leading-[1.4]" style={{ background: r.bg, color: r.fg }}>
                <Icon size={15} aria-hidden />{r.label}
              </span>
              {daysUntil(u.date, today) === 0
                ? <span className="w-[35px] text-center text-[14px] font-semibold tracking-[-0.308px]">Today</span>
                : <DateBlock iso={u.date} />}
            </>}
          />
        );
      }} />
    </Card>
  );
}
