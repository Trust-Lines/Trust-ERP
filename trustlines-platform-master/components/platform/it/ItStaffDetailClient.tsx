'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ComponentType, type ReactNode } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Copy,
  Layers,
  Mail,
  MapPin,
  MonitorSmartphone,
  Phone,
  Plus,
  Smartphone,
  Ticket,
  UserRound,
} from 'lucide-react';
import { PersonFace } from '@/components/ui/avatar-directory';
import { EmptyState } from '@/components/ui/empty-state';
import { roleLabel } from '@/components/platform/shell/Sidebar';
import { cn } from '@/lib/utils';
import { ItemCard } from './ItItemsLibraryClient';
import { EMPTY_ITEM, ItItemFormDialog } from './ItItemFormDialog';
import { MUTED, OUTLINE_CHIP, SOLID_CHIP, STRONG, type ItItem } from './itemStyles';
import { copyText, initials } from './itCardParts';
import { CATEGORY_TONE, PRIORITY_LABEL, PRIORITY_TONE, formatTicketDate, type ItTicketPriority, type ItTicketTone } from './ticketStyles';

// IT → Staff member: what one person holds, in the IT detail-page style (item / phone detail):
// Back, the person card, five counts, then Items (Items Library cards), Phone Lines, Mailbox,
// Subscriptions and IT Tickets. Every row links to its own page. edit.it can assign a new item to the person here.

export interface ItStaffPerson {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  active: boolean;
  joinedAt: string | null;
}

export interface ItStaffPhone {
  id: string;
  number: string;
  carrier: string | null;
  /** Company device name, "Personal phone", or null. */
  device: string | null;
  since: string | null;
  location: string | null;
}

export interface ItStaffTicket {
  id: string;
  subject: string;
  priority: ItTicketPriority;
  status: 'active' | 'closed';
  categoryLabel: string;
  categoryTone: ItTicketTone;
  createdAt: string;
}

export interface ItStaffSubscription {
  id: string;
  service: string;
  loginEmail: string;
  logoUrl: string | null;
  brandColor: string | null;
  dueDate: string | null;
  /** false = cancelled. */
  active: boolean;
}

export type ItStaffMailbox =
  | { state: 'found'; address: string }
  | { state: 'none' | 'not_connected' | 'unavailable'; address: null };

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

const PANEL = 'rounded-lg border border-solid border-primary-100 bg-primary-50 dark:border-primary-600 dark:bg-primary-700';
const ROW = cn(
  'flex min-w-0 items-center gap-3 rounded-md border border-solid border-primary-100 bg-white p-3 no-underline transition-colors hover:border-primary-300 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring dark:border-transparent dark:bg-secondary-800 dark:hover:border-primary-500',
  STRONG,
);
const CHIP = 'inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] font-semibold whitespace-nowrap';

function Section({ id, title, count, icon: Icon, action, children }: {
  id: string; title: string; count?: number; icon: IconType; action?: ReactNode; children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn('flex min-w-0 flex-col gap-4 px-5 pb-6 pt-4', PANEL)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className={cn('m-0 flex items-center gap-2 text-[18px] font-semibold leading-normal', STRONG)}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
          {title}
          {count !== undefined && <span className={cn('text-[14px] font-medium', MUTED)}>({count})</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, icon: Icon, href }: { label: string; value: ReactNode; icon: IconType; href: string }) {
  return (
    <a href={href} className={cn('flex min-w-0 items-center gap-3 p-4 no-underline transition-shadow hover:shadow-04 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring', PANEL)}>
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-white text-secondary-700 dark:bg-secondary-800 dark:text-secondary-50">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[12px] font-medium leading-4 text-ui-body">{label}</span>
        <span className={cn('truncate text-[22px] font-semibold leading-tight', STRONG)}>{value}</span>
      </span>
    </a>
  );
}

const MAILBOX_NOTE: Record<Exclude<ItStaffMailbox['state'], 'found'>, string> = {
  none: 'No Purelymail mailbox matches this person’s login email.',
  not_connected: 'Purelymail is not connected (PURELYMAIL_API_KEY is not set).',
  unavailable: 'Purelymail could not be reached — try again in a moment.',
};

function SubLogo({ sub }: { sub: ItStaffSubscription }) {
  const [failed, setFailed] = useState(false);
  if (!sub.logoUrl || failed) return <span className="text-[13px] font-semibold text-secondary-700">{initials(sub.service)}</span>;
  // eslint-disable-next-line @next/next/no-img-element -- service logos come from arbitrary hosts
  return <img src={sub.logoUrl} alt="" onError={() => setFailed(true)} className="max-h-full max-w-full object-contain" />;
}

export function ItStaffDetailClient({ person, items, phones, tickets, mailbox, subscriptions = [], canEdit, assignees }: {
  person: ItStaffPerson;
  items: ItItem[];
  phones: ItStaffPhone[];
  tickets: ItStaffTicket[];
  mailbox: ItStaffMailbox;
  subscriptions?: ItStaffSubscription[];
  /** edit.it: Assign item. */
  canEdit: boolean;
  assignees: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [assigning, setAssigning] = useState(false);
  const openTickets = tickets.filter(t => t.status === 'active').length;
  const liveSubs = subscriptions.filter(s => s.active).length;
  const location = items.find(i => i.location)?.location ?? phones.find(p => p.location)?.location ?? null;

  return (
    <div className="flex w-full flex-col gap-6 p-7 font-ui lg:p-16">
      {/* Heading */}
      <div className="flex flex-col gap-2">
        <Link
          href="/it/staff"
          className={cn('flex h-7 items-center gap-1 self-start rounded-md pl-[13px] pr-4 text-[13px] font-semibold no-underline hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring', OUTLINE_CHIP)}
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Back
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', STRONG)}>{person.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/team/${person.id}`}
              className={cn('flex h-10 items-center gap-2 rounded-md pl-3.5 pr-5 text-[13px] font-medium no-underline hover:opacity-80', OUTLINE_CHIP)}
            >
              <UserRound className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              View profile
            </Link>
            {canEdit && (
              <button
                type="button"
                onClick={() => setAssigning(true)}
                className={cn('flex h-10 items-center gap-2 rounded-md pl-3.5 pr-5 text-[13px] font-medium hover:opacity-90', SOLID_CHIP)}
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Assign item
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Person card + counts */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
        <div
          className="flex w-full shrink-0 items-center gap-3 rounded-[10px] border border-solid border-primary-100 p-3 text-secondary-50 dark:border-primary-600 xl:w-[420px]"
          style={{ backgroundImage: 'radial-gradient(circle at 22% 54%, rgba(31,37,45,0.2) 0%, rgba(120,136,161,0.2) 60%, transparent 61%), linear-gradient(90deg, #2b3d55 0%, #2b3d55 100%)' }}
        >
          <span className="grid size-[78px] shrink-0 place-items-center overflow-hidden rounded-lg bg-primary-950 text-[24px] font-semibold" aria-hidden="true">
            <PersonFace name={person.name} userId={person.id} fallback={initials(person.name) || '?'} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1 p-1">
            <p className="m-0 truncate text-[22px] font-semibold leading-normal">{person.name}</p>
            <p className="m-0 text-[12px] font-medium leading-[1.35]">
              {person.role ? roleLabel(person.role) : '—'}{!person.active && ' · Inactive'}
            </p>
            {person.email && (
              <button type="button" onClick={() => void copyText(person.email!, 'Email')} className="flex min-w-0 items-center gap-1 self-start text-left text-[12px] leading-[1.35] hover:underline" title="Copy email">
                <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span className="truncate">{person.email}</span>
              </button>
            )}
            <p className="m-0 flex flex-wrap items-center gap-x-3 text-[11px] leading-[1.35]">
              <span>Joined: <span className="font-medium">{formatTicketDate(person.joinedAt)}</span></span>
              {location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" strokeWidth={2} aria-hidden="true" />{location}</span>}
            </p>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-5">
          <Stat label="Items" value={items.length} icon={MonitorSmartphone} href="#staff-items" />
          <Stat label="Phone Lines" value={phones.length} icon={Phone} href="#staff-phones" />
          <Stat label="Mailbox" value={mailbox.state === 'found' ? 'Yes' : mailbox.state === 'none' ? 'No' : '—'} icon={Mail} href="#staff-mailbox" />
          <Stat label="Subscriptions" value={liveSubs} icon={Layers} href="#staff-subscriptions" />
          <Stat label="Open Tickets" value={openTickets} icon={Ticket} href="#staff-tickets" />
        </div>
      </div>

      {/* Items */}
      <Section id="staff-items" title="Items" count={items.length} icon={MonitorSmartphone}>
        {items.length === 0 ? (
          <EmptyState size="sm" title="No items assigned." description={canEdit ? 'Use Assign item to give this person equipment.' : undefined} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {items.map(item => <ItemCard key={item.id} item={item} canEdit={canEdit} />)}
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
        {/* Phone lines */}
        <Section id="staff-phones" title="Phone Lines" count={phones.length} icon={Phone}>
          {phones.length === 0 ? (
            <EmptyState size="sm" title="No phone lines." />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {phones.map(p => (
                <li key={p.id}>
                  <Link href={`/it/phones/${p.id}`} className={ROW}>
                    <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-50 dark:bg-primary-700">
                      <Smartphone className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-semibold">{p.number}</span>
                      <span className={cn('truncate text-[12px]', MUTED)}>
                        {[p.carrier, p.device, p.since && `Since ${formatTicketDate(p.since)}`].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>
                    <ChevronRight className={cn('h-4 w-4 shrink-0', MUTED)} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Mailbox */}
        <Section id="staff-mailbox" title="Mailbox" icon={Mail}>
          {mailbox.state === 'found' ? (
            <div className={cn(ROW, 'hover:border-primary-100 dark:hover:border-transparent')}>
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-50 dark:bg-primary-700">
                <Mail className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold">{mailbox.address}</span>
                <span className={cn('text-[12px]', MUTED)}>Purelymail mailbox</span>
              </span>
              <button type="button" onClick={() => void copyText(mailbox.address, 'Email')} aria-label="Copy email" className="grid size-8 shrink-0 place-items-center rounded hover:opacity-80 focus-visible:outline-2 focus-visible:outline-ui-focus-ring">
                <Copy className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
              </button>
              <Link href="/it/mails" className={cn('flex h-8 shrink-0 items-center rounded-md px-3 text-[12px] font-semibold no-underline hover:opacity-80', OUTLINE_CHIP)}>
                Manage
              </Link>
            </div>
          ) : (
            <EmptyState size="sm" title={MAILBOX_NOTE[mailbox.state]} />
          )}
        </Section>
      </div>

      {/* Subscriptions */}
      <Section
        id="staff-subscriptions" title="Subscriptions" count={subscriptions.length} icon={Layers}
        action={<Link href="/it/subscriptions" className={cn('flex h-8 items-center rounded-md px-3 text-[12px] font-semibold no-underline hover:opacity-80', OUTLINE_CHIP)}>Manage</Link>}
      >
        {subscriptions.length === 0 ? (
          <EmptyState size="sm" title="Not listed on any subscription." description={canEdit ? 'Add them as a user in IT → Subscriptions.' : undefined} />
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-2 2xl:grid-cols-3">
            {subscriptions.map(s => (
              <li key={s.id} className="min-w-0">
                <Link href="/it/subscriptions" className={ROW}>
                  <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-[4px] bg-white p-1">
                    <SubLogo sub={s} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-semibold" style={s.brandColor ? { color: s.brandColor } : undefined}>{s.service}</span>
                    <span className={cn('truncate text-[12px]', MUTED)}>
                      {[s.loginEmail, s.dueDate && `Due ${formatTicketDate(s.dueDate)}`].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </span>
                  {!s.active && <span className={cn(CHIP, OUTLINE_CHIP)}>Cancelled</span>}
                  <ChevronRight className={cn('h-4 w-4 shrink-0', MUTED)} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Tickets */}
      <Section id="staff-tickets" title="IT Tickets" count={tickets.length} icon={Ticket}>
        {tickets.length === 0 ? (
          <EmptyState size="sm" title="No IT tickets from this person." />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {tickets.map(t => {
              const cat = CATEGORY_TONE[t.categoryTone];
              const pri = PRIORITY_TONE[t.priority];
              return (
                <li key={t.id}>
                  <Link href={`/it/tickets/${encodeURIComponent(t.id)}`} className={cn(ROW, 'flex-wrap sm:flex-nowrap')}>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-semibold">{t.subject}</span>
                      <span className={cn('text-[12px]', MUTED)}>{formatTicketDate(t.createdAt)}</span>
                    </span>
                    <span className={CHIP} style={{ background: cat.bg, color: cat.fg }}>{t.categoryLabel}</span>
                    <span className={CHIP} style={{ background: pri.bg, color: pri.fg }}>{PRIORITY_LABEL[t.priority]}</span>
                    <span className={cn(CHIP, t.status === 'active' ? SOLID_CHIP : OUTLINE_CHIP)}>{t.status === 'active' ? 'Active' : 'Closed'}</span>
                    <ChevronRight className={cn('h-4 w-4 shrink-0', MUTED)} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {assigning && (
        <ItItemFormDialog
          initial={{ ...EMPTY_ITEM, status: 'assigned', assigneeId: person.id }}
          assignees={assignees}
          onClose={() => setAssigning(false)}
          onSaved={id => router.push(`/it/items/${encodeURIComponent(id)}`)}
          onCreated={() => router.refresh()}
        />
      )}
    </div>
  );
}
