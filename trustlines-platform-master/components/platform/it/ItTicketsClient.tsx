'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowDownUp, Plus, Search } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/platform/shared/Avatar';
import { PageHeading } from '@/components/platform/shared/PageHeading';
import {
  CATEGORY_ICON,
  CATEGORY_TONE,
  NOT_CONNECTED_TITLE,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  TOOLBAR_SELECT,
  TOOLBAR_SORT_ICON,
  formatTicketDate,
  type ItTicketPriority,
  type ItTicketStatus,
  type ItTicketTone,
} from './ticketStyles';

// Figma "IT Tickets" (828:37587): page heading with count, Active / History tabs, search, sort and
// priority filters, then a grid of request cards.

export interface ItTicket {
  id: string;
  requesterName: string;
  requesterRole: string;
  priority: ItTicketPriority;
  status: ItTicketStatus;
  categoryLabel: string;
  categoryTone: ItTicketTone;
  /** ISO date the request is needed by ("For: …"). */
  neededBy: string | null;
  /** ISO timestamp, used by the "Newest" sort. */
  createdAt: string;
}

export type ItTicketSort = 'newest' | 'oldest';
export type ItTicketTab = 'active' | 'history';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
];
// "" is the shared Select's "all" value; its label doubles as the trigger text (Figma "Priority").
const PRIORITY_OPTIONS = [
  { value: '', label: 'Priority' },
  ...(Object.keys(PRIORITY_LABEL) as ItTicketPriority[]).map(p => ({ value: p, label: PRIORITY_LABEL[p] })),
];

// Light / dark per Figma 828:37587 and 880:14096: input border primary-200 / secondary-500,
// secondary text primary-400 / primary-200, strong text secondary-700 / secondary-50.
const FIELD =
  'h-10 rounded-md border border-primary-200 bg-white px-3 text-[13px] font-ui text-secondary-700 outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring dark:border-secondary-500 dark:bg-primary-800 dark:text-secondary-50';
const MUTED = 'text-primary-400 dark:text-primary-200';
const STRONG = 'text-secondary-700 dark:text-secondary-50';

function TicketCard({ ticket }: { ticket: ItTicket }) {
  const priority = PRIORITY_TONE[ticket.priority];
  const category = CATEGORY_TONE[ticket.categoryTone];
  const CategoryIcon = CATEGORY_ICON[ticket.categoryTone];
  return (
    <Link
      href={`/it/tickets/${encodeURIComponent(ticket.id)}`}
      aria-label={`${ticket.requesterName}, ${PRIORITY_LABEL[ticket.priority]} request`}
      className="flex flex-col gap-4 rounded-[11px] border border-primary-100 bg-white py-2.5 pl-2.5 pr-3.5 no-underline transition-colors hover:border-primary-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring dark:border-primary-600 dark:bg-secondary-800 dark:hover:border-secondary-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={ticket.requesterName} size="lg" />
          <div className="flex flex-col leading-[1.35]">
            <p className={cn('m-0 text-[16px] font-semibold tracking-[-0.44px]', STRONG)}>{ticket.requesterName}</p>
            <p className={cn('m-0 text-[13px] tracking-[-0.3px]', MUTED)}>{ticket.requesterRole}</p>
          </div>
        </div>
        <span
          className="rounded px-2.5 py-0.5 text-[14px] font-medium leading-[1.4]"
          style={{ background: priority.bg, color: priority.fg }}
        >
          {PRIORITY_LABEL[ticket.priority]}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span
          className="inline-flex items-center gap-2 rounded py-0.5 pl-1.5 pr-2 text-[14px] font-medium leading-[1.4]"
          style={{ background: category.bg, color: category.fg }}
        >
          {CategoryIcon && <CategoryIcon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
          {ticket.categoryLabel}
        </span>
        <p className="m-0 flex items-center gap-1 whitespace-nowrap text-[14px] leading-[1.4]">
          <span className={MUTED}>For:</span>
          <span className={cn('font-medium', STRONG)}>{formatTicketDate(ticket.neededBy)}</span>
        </p>
      </div>
    </Link>
  );
}

export function ItTicketsClient({ tickets, error = null, canCreate = false }: {
  tickets: ItTicket[];
  error?: string | null;
  canCreate?: boolean;
}) {
  const [tab, setTab] = useState<ItTicketTab>('active');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ItTicketSort>('newest');
  const [priority, setPriority] = useState<ItTicketPriority | 'all'>('all');

  const activeCount = useMemo(() => tickets.filter(t => t.status === 'active').length, [tickets]);

  const visible = useMemo(() => {
    const wanted: ItTicketStatus = tab === 'active' ? 'active' : 'closed';
    const q = query.trim().toLowerCase();
    return tickets
      .filter(t => t.status === wanted)
      .filter(t => priority === 'all' || t.priority === priority)
      .filter(t => !q || t.requesterName.toLowerCase().includes(q) || t.categoryLabel.toLowerCase().includes(q) || t.requesterRole.toLowerCase().includes(q))
      .sort((a, b) => {
        const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return sort === 'newest' ? -diff : diff;
      });
  }, [tickets, tab, query, sort, priority]);

  const tabClass = (on: boolean) =>
    cn(
      'flex h-full items-center border-b-[3px] border-solid text-[13px] transition-colors',
      on
        ? 'border-secondary-700 font-semibold text-secondary-700 dark:border-secondary-50 dark:text-secondary-50'
        : cn('border-transparent hover:text-secondary-700 dark:hover:text-secondary-50', MUTED),
    );

  return (
    <div className="flex w-full flex-col gap-[30px] p-7 font-ui">
      <PageHeading
        trail={[{ label: 'IT', href: '/it/tickets' }, { label: 'Tickets', href: '/it/tickets' }]}
        title="Tickets"
        subtitle="Sent tickets"
        bodyClassName="gap-2"
        titleAdornment={
          <span className="rounded-full bg-primary-50 px-[9px] py-[3px] text-[12px] font-semibold leading-[1.4] text-secondary-700 dark:bg-primary-700 dark:text-secondary-50">
            <span className="sr-only">Active tickets: </span>{activeCount}
          </span>
        }
        actions={
          <button
            type="button"
            disabled={!canCreate}
            title={canCreate ? undefined : NOT_CONNECTED_TITLE}
            className="flex h-9 items-center gap-2 rounded-md bg-accent-400 px-3 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-950"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            New request
          </button>
        }
      />

      <div role="tablist" aria-label="Ticket views" className="flex h-12 items-stretch gap-8 border-b border-solid border-primary-100 dark:border-primary-600">
        <button role="tab" type="button" aria-selected={tab === 'active'} onClick={() => setTab('active')} className={tabClass(tab === 'active')}>
          Active Tickets
        </button>
        <button role="tab" type="button" aria-selected={tab === 'history'} onClick={() => setTab('history')} className={tabClass(tab === 'history')}>
          History
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative flex w-[380px] max-w-full items-center">
          <Search className={cn('pointer-events-none absolute left-3 h-4 w-4', MUTED)} strokeWidth={1.5} aria-hidden="true" />
          <span className="sr-only">Search requests</span>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search requests…"
            className={cn(FIELD, 'w-full pl-9 placeholder:text-primary-400 dark:placeholder:text-primary-200')}
          />
        </label>
        <div className="relative">
          <ArrowDownUp aria-hidden="true" className={TOOLBAR_SORT_ICON} />
          <Select
            aria-label="Sort requests"
            className={cn(TOOLBAR_SELECT, 'pl-[34px] dark:pl-[34px]')}
            value={sort}
            onValueChange={v => setSort((v ?? 'newest') as ItTicketSort)}
            options={SORT_OPTIONS}
          />
        </div>
        <Select
          aria-label="Filter by priority"
          className={cn(TOOLBAR_SELECT, 'pl-3 dark:pl-3')}
          value={priority === 'all' ? '' : priority}
          onValueChange={v => setPriority((v || 'all') as ItTicketPriority | 'all')}
          options={PRIORITY_OPTIONS}
        />
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-[var(--status-t10-fg)] bg-[var(--status-t10-bg)] px-4 py-3 text-[13px] text-[var(--status-t10-fg)]">
          {error}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-[11px] border border-dashed border-primary-300 px-6 py-14 text-center dark:border-primary-600">
          <p className="m-0 text-[15px] font-semibold text-secondary-700 dark:text-primary-50">
            {tab === 'active' ? 'No active tickets' : 'No closed tickets'}
          </p>
          <p className="m-0 text-[13px] text-ui-body">
            {tickets.length === 0 ? 'IT requests you send will show up here.' : 'Nothing matches these filters.'}
          </p>
        </div>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
          {visible.map(t => (
            <li key={t.id}>
              <TicketCard ticket={t} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
