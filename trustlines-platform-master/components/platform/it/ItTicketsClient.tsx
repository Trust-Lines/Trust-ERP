'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ListFilter, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/platform/shared/Avatar';
import { PageHeading } from '@/components/platform/shared/PageHeading';

// Figma "IT Tickets" (828:37587): page heading with count, Active / History tabs, search, sort and
// priority filters, then a grid of request cards.

export type ItTicketPriority = 'important' | 'medium' | 'low';
export type ItTicketStatus = 'active' | 'closed';
export type ItTicketTone = 'success' | 'teal' | 'neutral';

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

const PRIORITY_LABEL: Record<ItTicketPriority, string> = {
  important: 'Important',
  medium: 'Medium',
  low: 'Low',
};

// Figma chip tokens: Important = t10 (red), Medium = t7 (amber), Low = t9 (green).
const PRIORITY_TONE: Record<ItTicketPriority, { bg: string; fg: string }> = {
  important: { bg: 'var(--status-t10-bg)', fg: 'var(--status-t10-fg)' },
  medium: { bg: 'var(--status-t7-bg)', fg: 'var(--status-t7-fg)' },
  low: { bg: 'var(--status-t9-bg)', fg: 'var(--status-t9-fg)' },
};

const CATEGORY_TONE: Record<ItTicketTone, { bg: string; fg: string }> = {
  success: { bg: 'var(--status-t9-bg)', fg: 'var(--status-t9-fg)' },
  teal: { bg: 'var(--status-t5-bg)', fg: 'var(--status-t5-fg)' },
  neutral: { bg: 'var(--status-t0-bg)', fg: 'var(--status-t0-fg)' },
};

const FIELD =
  'h-10 rounded-md border border-primary-300 bg-white px-3 text-[13px] font-ui text-primary-500 outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring dark:border-primary-600 dark:bg-primary-800 dark:text-primary-50';

function formatNeededBy(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
}

function TicketCard({ ticket }: { ticket: ItTicket }) {
  const priority = PRIORITY_TONE[ticket.priority];
  const category = CATEGORY_TONE[ticket.categoryTone];
  return (
    <article
      aria-label={`${ticket.requesterName}, ${PRIORITY_LABEL[ticket.priority]} request`}
      className="flex flex-col gap-4 rounded-[11px] border border-primary-100 bg-white py-2.5 pl-2.5 pr-3.5 dark:border-primary-600 dark:bg-primary-800"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={ticket.requesterName} size="lg" />
          <div className="flex flex-col leading-[1.35]">
            <p className="m-0 text-[16px] font-semibold tracking-[-0.44px] text-secondary-700 dark:text-primary-50">{ticket.requesterName}</p>
            <p className="m-0 text-[13px] tracking-[-0.3px] text-ui-body">{ticket.requesterRole}</p>
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
          {ticket.categoryLabel}
        </span>
        <p className="m-0 flex items-center gap-1 whitespace-nowrap text-[14px] leading-[1.4]">
          <span className="text-ui-body">For:</span>
          <span className="font-medium text-secondary-700 dark:text-primary-50">{formatNeededBy(ticket.neededBy)}</span>
        </p>
      </div>
    </article>
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
        ? 'border-primary-500 font-semibold text-secondary-700 dark:border-primary-50 dark:text-primary-50'
        : 'border-transparent text-ui-body hover:text-secondary-700 dark:hover:text-primary-50',
    );

  return (
    <div className="flex w-full flex-col gap-[30px] p-7 font-ui">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeading
          trail="IT / Tickets"
          title="Tickets"
          subtitle="Sent tickets"
          bodyClassName="gap-2"
          actions={
            <button
              type="button"
              disabled={!canCreate}
              title={canCreate ? undefined : 'Creating IT requests is not available yet'}
              className="flex h-9 items-center gap-2 rounded-md bg-accent-400 px-3 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              New request
            </button>
          }
        />
      </div>

      <div role="tablist" aria-label="Ticket views" className="flex h-12 items-stretch gap-8 border-b border-solid border-primary-100 dark:border-primary-600">
        <button role="tab" type="button" aria-selected={tab === 'active'} onClick={() => setTab('active')} className={tabClass(tab === 'active')}>
          Active Tickets
          <span className="ml-2 rounded-full bg-primary-50 px-2 py-px text-[12px] font-semibold text-secondary-700 dark:bg-primary-800 dark:text-primary-50">{activeCount}</span>
        </button>
        <button role="tab" type="button" aria-selected={tab === 'history'} onClick={() => setTab('history')} className={tabClass(tab === 'history')}>
          History
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative flex w-[380px] max-w-full items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-ui-body" strokeWidth={1.5} aria-hidden="true" />
          <span className="sr-only">Search requests</span>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search requests…"
            className={cn(FIELD, 'w-full pl-9')}
          />
        </label>
        <label className="relative flex items-center">
          <ListFilter className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-primary-500" strokeWidth={1.5} aria-hidden="true" />
          <span className="sr-only">Sort requests</span>
          <select value={sort} onChange={e => setSort(e.target.value as ItTicketSort)} className={cn(FIELD, 'appearance-none pl-8 pr-8 font-medium text-secondary-700')}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-primary-500" strokeWidth={1.5} aria-hidden="true" />
        </label>
        <label className="relative flex items-center">
          <span className="sr-only">Filter by priority</span>
          <select value={priority} onChange={e => setPriority(e.target.value as ItTicketPriority | 'all')} className={cn(FIELD, 'appearance-none pl-4 pr-8 font-medium text-secondary-700')}>
            <option value="all">Priority</option>
            <option value="important">Important</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-primary-500" strokeWidth={1.5} aria-hidden="true" />
        </label>
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
