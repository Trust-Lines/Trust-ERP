'use client';

import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';
import { useState } from 'react';
import Link from 'next/link';
import {
  Contact, UserPen, FlagOff, BriefcaseBusiness, Eye, ArrowUpRight, CircleCheck, CircleX, Clock, PartyPopper,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MyDayItem, MyDaySection } from '@/lib/dashboard/myDay';
import { StatCard } from '@/components/platform/shared/StatCard';

const PAGE_SIZE = 20;

interface MyStats {
  contactsTotal: number;
  incompleteCount: number;
  unqualifiedCount: number;
  contractSignedCount: number;
  weeklyActivityCount: number;
}

interface Props {
  role: string;
  fullName: string | null;
  isManager: boolean;
  // Still passed by app/(platform)/marketing/page.tsx; the Figma "Marketing Home" layout
  // (node 244:17297) has no pipeline-shortcut strip, so they aren't rendered any more —
  // Contacts / Handoffs are reachable from the sidebar.
  prospectCount: number | null;
  potentialCount: number | null;
  myDaySections: MyDaySection[];
  // Team-wide, real-data-gap tasks (unfollowed Potentials, Contacts with missing info,
  // missing-region records, anniversaries, upcoming events) — generated the same way for
  // everyone now, not scoped to "assigned to me" (myDaySections), which turned out to be an
  // unreliable signal. See lib/marketing/teamGaps.ts.
  teamGapSections: MyDaySection[];
  // Personal completion percentages — everything here is derived from data this person
  // already owns/is assigned (never a $ figure; marketing_pr never sees pricing).
  myStats: MyStats;
}

const ROLE_LABEL: Record<string, string> = {
  marketing_pr: 'Marketing & PR',
  marketing_manager: 'Marketing Manager',
  ops_manager: 'Ops Manager',
  general_manager: 'General Manager',
};

// "Today's actions" — the Marketing-specific My Day sections. 'prospects_assigned' ("My
// Leads") stays out: it isn't a task, it's every Contact this person has ever touched
// (thousands for the ClickUp-import account) and already lives on the Contacts page.
const MARKETING_SECTION_ORDER = ['nurture_overdue', 'handoffs_waiting', 'potentials_due'];

// Figma "Unread Notifications" panel: things waiting on this person to open/sign.
const INBOX_SECTION_ORDER = ['signatures', 'notifications'];

// Status Chip tones (Figma 48:500) — colour is never the only signal, so each tone has an icon.
const TONE_CHIP: Record<NonNullable<MyDayItem['tone']>, { tone: string; icon: LucideIcon }> = {
  danger:  { tone: 't10', icon: CircleX },
  warn:    { tone: 't7',  icon: Clock },
  good:    { tone: 't9',  icon: CircleCheck },
  default: { tone: 't0',  icon: CircleCheck },
};

const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';

function sectionLabel(title: string): string {
  return title.replace(/\s*\(\d+\)$/, '');
}

export function MarketingWorkspaceClient({ role, isManager, myDaySections, teamGapSections, myStats }: Props) {
  const mySections = MARKETING_SECTION_ORDER
    .map(key => myDaySections.find(s => s.key === key))
    .filter((s): s is MyDaySection => !!s && s.items.length > 0);
  // Team-wide gaps first — for a manager these are the real work (their own "assigned to
  // me" list is naturally empty).
  const actionSections = [...teamGapSections, ...mySections].filter(s => s.items.length > 0);
  const actions = actionSections.flatMap(s => s.items.map(item => ({ item, category: sectionLabel(s.title), key: s.key })));

  const inbox = INBOX_SECTION_ORDER
    .map(key => myDaySections.find(s => s.key === key))
    .filter((s): s is MyDaySection => !!s)
    .flatMap(s => s.items);

  const incompletePct = myStats.contactsTotal > 0 ? Math.round((myStats.incompleteCount / myStats.contactsTotal) * 100) : 0;

  return (
    <div className="flex flex-col gap-[30px]">
      {/* ── Page heading ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'Marketing', href: '/marketing' }, { label: 'Home', href: '/marketing' }]} />
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING)}>Marketing Home</h1>
        <p className="text-[13px] text-ui-body">
          {ROLE_LABEL[role] ?? role} · {isManager ? 'sees every Lead and Opportunity' : 'sees Leads and Opportunities in your region'}
          {` · ${myStats.weeklyActivityCount} action${myStats.weeklyActivityCount === 1 ? '' : 's'} this week`}
        </p>
      </div>

      {/* ── KPI cards — incomplete Contacts, unqualified count, contract-signed count (from
          the real Sales `projects.closed_deal_date`), completed projects (not wired up yet).
          Never a $ figure. ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Contact}
          label="My Leads"
          value={myStats.contactsTotal}
          chip={`${myStats.contractSignedCount} signed`}
          href="/marketing/prospects"
        />
        <StatCard
          icon={UserPen}
          label="Incomplete Contacts"
          value={myStats.incompleteCount}
          chip={`${incompletePct}% of all`}
        />
        <StatCard icon={FlagOff} label="Unqualified clients" value={myStats.unqualifiedCount} />
        <StatCard icon={BriefcaseBusiness} label="Completed projects" value="—" chip="Soon" />
      </div>

      {/* ── Personal priorities ─────────────────────────────────────────── */}
      <div className="flex flex-col items-stretch gap-6 xl:flex-row xl:items-start">
        <InboxPanel items={inbox} />
        <ActionsPanel actions={actions} />
      </div>
    </div>
  );
}

function StatusChip({ tone, label }: { tone: NonNullable<MyDayItem['tone']>; label: string }) {
  const { tone: t, icon: Icon } = TONE_CHIP[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-tag py-[3px] pl-2 pr-2.5 text-[12px] font-medium leading-4 whitespace-nowrap"
      style={{ background: `var(--status-${t}-bg)`, color: `var(--status-${t}-fg)` }}
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}

function LoadMore({ remaining, onClick }: { remaining: number; onClick: () => void }) {
  if (remaining <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 self-start text-[12px] font-medium text-ui-nav-active hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring"
    >
      Load {Math.min(PAGE_SIZE, remaining)} more ({remaining} left)
    </button>
  );
}

function InboxPanel({ items }: { items: MyDayItem[] }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visible = items.slice(0, visibleCount);

  return (
    <section className="flex min-h-[483px] min-w-0 flex-1 flex-col gap-5 rounded-[10px] border border-ui-divider p-5">
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2 className={cn('m-0 text-[17px] font-semibold leading-[1.4]', HEADING)}>Unread Notifications</h2>
            <StatusChip tone="default" label={`${items.length} open`} />
          </div>
          <span className="text-[12px] leading-[1.4] text-ui-text-secondary">Newest first</span>
        </div>
        <p className="text-[12px] leading-[1.4] text-ui-text-secondary">Your signatures, alerts and updates across Marketing.</p>
      </div>

      {items.length === 0 ? (
        <CaughtUp text="No unread notifications and nothing waiting for your signature." />
      ) : (
        <div className="flex flex-col">
          {visible.map((item, i) => (
            <div
              key={`${item.href}-${i}`}
              className="flex min-h-[84px] items-center gap-3.5 border-b border-ui-divider py-[13px] last:border-b-0"
            >
              <span aria-hidden className="grid size-[34px] shrink-0 place-items-center rounded-[6px] bg-ui-surface">
                <Eye className="size-3.5 text-ui-body" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1 leading-[1.4]">
                <span className="truncate text-[14px] font-semibold text-ui-body">{item.label}</span>
                {item.sublabel && <span className="truncate text-[12px] text-ui-text-secondary">{item.sublabel}</span>}
              </div>
              {item.badge && item.tone && item.tone !== 'default' && (
                <StatusChip tone={item.tone} label={item.badge} />
              )}
              <Link
                href={item.href}
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[6px] border border-ui-divider bg-ui-input-bg px-3 text-[13px] font-medium leading-[1.4] text-ui-body no-underline outline-none hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring"
              >
                <ArrowUpRight aria-hidden className="size-4" />
                Open
              </Link>
            </div>
          ))}
          <LoadMore remaining={items.length - visible.length} onClick={() => setVisibleCount(c => c + PAGE_SIZE)} />
        </div>
      )}
    </section>
  );
}

function ActionsPanel({ actions }: { actions: { item: MyDayItem; category: string; key: string }[] }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visible = actions.slice(0, visibleCount);

  return (
    <section className="flex min-h-[483px] w-full shrink-0 flex-col gap-[22px] rounded-control border border-ui-divider pb-5 pl-4 pr-[18px] pt-3.5 xl:w-[567px]">
      <h2 className={cn('m-0 text-[20px] font-semibold leading-[25px] tracking-[0.4px]', HEADING)}>Today&rsquo;s actions</h2>

      {actions.length === 0 ? (
        <CaughtUp text="No overdue follow-ups, no potentials due, no handoffs waiting on you right now." />
      ) : (
        <div className="flex flex-col">
          {visible.map(({ item, category, key }, i) => (
            <Link
              key={`${key}-${i}`}
              href={item.href}
              title={item.sublabel}
              className="-mx-1.5 flex items-center justify-between gap-3 rounded-tag border-b border-ui-divider px-1.5 py-[5px] text-inherit no-underline outline-none last:border-b-0 hover:bg-ui-surface focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring"
            >
              <span className={cn('min-w-0 truncate text-[14px] font-medium leading-[1.5] tracking-[-0.308px]', HEADING)}>{item.label}</span>
              <span className={cn('max-w-[45%] shrink-0 truncate rounded-tag bg-ui-selected-bg px-2.5 text-right text-[12px] leading-[1.5] tracking-[-0.264px]', HEADING)}>
                {item.badge ?? category}
              </span>
            </Link>
          ))}
          <LoadMore remaining={actions.length - visible.length} onClick={() => setVisibleCount(c => c + PAGE_SIZE)} />
        </div>
      )}
    </section>
  );
}

function CaughtUp({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <PartyPopper aria-hidden className="size-[22px] shrink-0 text-success-dark" />
      <div>
        <div className={cn('text-[13.5px] font-semibold', HEADING)}>You&apos;re all caught up</div>
        <div className="mt-0.5 text-[12px] text-ui-text-secondary">{text}</div>
      </div>
    </div>
  );
}
