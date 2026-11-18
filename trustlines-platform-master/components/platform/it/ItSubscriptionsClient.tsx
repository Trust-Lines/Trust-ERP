'use client';

import { useMemo, useState } from 'react';
import { ArrowDownUp, CreditCard, Eye, EyeOff, Plus, Search, UserRound } from 'lucide-react';
import { PageHeading } from '@/components/platform/shared/PageHeading';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TOOLBAR_SELECT, TOOLBAR_SORT_ICON } from './ticketStyles';
import { CARD, CardHead, FIELD, MUTED, SORT_OPTIONS, STRONG, SecretField, initials, tabClass } from './itCardParts';

// Figma "IT / Subscriptions" (908:22728): the company's software subscriptions, one card each —
// service logo and name (in its brand colour), the login address and password, seats, the payment
// card's last four digits, and the start / due dates. Same page layout as IT / Mails.
//
// There is no subscriptions data source yet, so the page passes an empty list. Only the card's last
// four digits are ever shown, and the login password is fetched on demand (`onRevealPassword`),
// never sent with the list.

export interface ItSubscription {
  id: string;
  service: string;
  loginEmail: string;
  logoUrl: string | null;
  /** Brand colour for the service name, e.g. "#DA1F26". */
  brandColor: string | null;
  seats: number | null;
  cardLast4: string | null;
  /** ISO dates. */
  startDate: string | null;
  dueDate: string | null;
  /** false = cancelled, listed under History. */
  active: boolean;
  /** ISO timestamp, used by the sort. */
  createdAt: string;
}

type Tab = 'active' | 'history';
type Sort = 'newest' | 'oldest' | 'name';

const NOT_CONNECTED = 'Not available yet: the subscriptions data source is not connected';
const DUE_SOON_DAYS = 30;
const CHIP = cn('inline-flex h-7 items-center gap-1 rounded-[4px] border border-secondary-700 pl-2 pr-3 text-[13px] font-semibold dark:border-secondary-50', STRONG);

/** "2026-01-05" → "5 JAN 2026". */
function formatDay(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' }).toUpperCase()} ${d.getFullYear()}`;
}

/** Due date is red when it has passed or is within 30 days. */
function isDueSoon(iso: string | null) {
  if (!iso) return false;
  const due = new Date(`${iso.slice(0, 10)}T00:00:00`).getTime();
  return due - Date.now() <= DUE_SOON_DAYS * 86_400_000;
}

function ServiceLogo({ sub }: { sub: ItSubscription }) {
  const [failed, setFailed] = useState(false);
  if (!sub.logoUrl || failed) return <>{initials(sub.service)}</>;
  // eslint-disable-next-line @next/next/no-img-element -- service logos come from arbitrary hosts
  return <img src={sub.logoUrl} alt="" onError={() => setFailed(true)} className="max-h-full max-w-full object-contain" />;
}

function SubscriptionCard({ sub, showInfo, onRevealPassword }: {
  sub: ItSubscription;
  showInfo: boolean;
  onRevealPassword?: (id: string) => Promise<string>;
}) {
  const dueSoon = isDueSoon(sub.dueDate);
  return (
    <article className={CARD}>
      <CardHead
        title={sub.service}
        titleStyle={sub.brandColor ? { color: sub.brandColor } : undefined}
        email={sub.loginEmail}
        // Figma 908:24358: white "elevated surface" logo tile, 4px radius and padding.
        pictureClassName="rounded-[4px] bg-white p-1 dark:bg-white dark:text-secondary-700"
        picture={<ServiceLogo sub={sub} />}
      />
      <SecretField id={sub.id} label={sub.service} showInfo={showInfo} onReveal={onRevealPassword} notConnectedTitle={NOT_CONNECTED} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={CHIP}>
          <UserRound size={16} aria-hidden />
          {sub.seats != null ? `${sub.seats} User${sub.seats === 1 ? '' : 's'}` : '— Users'}
        </span>
        {sub.cardLast4 && (
          <span className={CHIP}>
            <CreditCard size={16} aria-hidden />
            <span className="sr-only">Card ending in </span>
            <span aria-hidden>**** **** **** </span>{sub.cardLast4}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-2 text-[13px] font-semibold whitespace-nowrap">
        <p className={cn('m-0', STRONG)}><span className="font-normal">Start:</span> {formatDay(sub.startDate)}</p>
        <p className={cn('m-0', dueSoon ? 'text-error-normal' : STRONG)}><span className="font-normal">Due:</span> {formatDay(sub.dueDate)}</p>
      </div>
    </article>
  );
}

export function ItSubscriptionsClient({ subscriptions, error = null, canCreate = false, onRevealPassword }: {
  subscriptions: ItSubscription[];
  error?: string | null;
  canCreate?: boolean;
  onRevealPassword?: (id: string) => Promise<string>;
}) {
  const [tab, setTab] = useState<Tab>('active');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [service, setService] = useState('');
  const [showInfo, setShowInfo] = useState(false);

  const activeCount = useMemo(() => subscriptions.filter(s => s.active).length, [subscriptions]);
  const serviceOptions = useMemo(() => {
    const names = [...new Set(subscriptions.map(s => s.service).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return [{ value: '', label: 'All Subscriptions' }, ...names.map(n => ({ value: n, label: n }))];
  }, [subscriptions]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subscriptions
      .filter(s => s.active === (tab === 'active'))
      .filter(s => !service || s.service === service)
      .filter(s => !q || `${s.service} ${s.loginEmail}`.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === 'name') return a.service.localeCompare(b.service);
        const diff = Date.parse(a.createdAt) - Date.parse(b.createdAt);
        return sort === 'newest' ? -diff : diff;
      });
  }, [subscriptions, tab, service, query, sort]);

  return (
    <div className="flex w-full flex-col gap-[30px] p-7 font-ui">
      <PageHeading
        trail={[{ label: 'IT', href: '/it/tickets' }, { label: 'Subscriptions', href: '/it/subscriptions' }]}
        title="Subscriptions"
        subtitle="Company software subscriptions"
        bodyClassName="gap-2"
        titleAdornment={
          <span className="rounded-full bg-primary-50 px-[9px] py-[3px] text-[12px] font-semibold leading-[1.4] text-secondary-700 dark:bg-primary-700 dark:text-secondary-50">
            <span className="sr-only">Active subscriptions: </span>{activeCount}
          </span>
        }
        actions={
          <button
            type="button"
            disabled={!canCreate}
            title={canCreate ? undefined : NOT_CONNECTED}
            className="flex h-9 items-center gap-2 rounded-md bg-accent-400 px-3 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-950"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            New request
          </button>
        }
      />

      <div role="tablist" aria-label="Subscription views" className="flex h-12 items-stretch gap-8 border-b border-solid border-primary-100 dark:border-primary-600">
        <button role="tab" type="button" aria-selected={tab === 'active'} onClick={() => setTab('active')} className={tabClass(tab === 'active')}>
          Active Subscriptions
        </button>
        <button role="tab" type="button" aria-selected={tab === 'history'} onClick={() => setTab('history')} className={tabClass(tab === 'history')}>
          History
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="relative flex w-[380px] max-w-full items-center">
            <Search className={cn('pointer-events-none absolute left-3 h-4 w-4', MUTED)} strokeWidth={1.5} aria-hidden="true" />
            <span className="sr-only">Search subscriptions</span>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search subscriptions…"
              className={cn(FIELD, 'w-full pl-9 placeholder:text-primary-400 dark:placeholder:text-primary-200')}
            />
          </label>
          <div className="relative">
            <ArrowDownUp aria-hidden="true" className={TOOLBAR_SORT_ICON} />
            <Select
              aria-label="Sort subscriptions"
              className={cn(TOOLBAR_SELECT, 'pl-[34px] dark:pl-[34px]')}
              value={sort}
              onValueChange={v => setSort((v ?? 'newest') as Sort)}
              options={SORT_OPTIONS}
            />
          </div>
          <Select
            aria-label="Filter by service"
            className={cn(TOOLBAR_SELECT, 'pl-3 dark:pl-3')}
            value={service}
            onValueChange={v => setService(v ?? '')}
            options={serviceOptions}
          />
        </div>
        <button
          type="button"
          aria-pressed={showInfo}
          onClick={() => setShowInfo(s => !s)}
          disabled={!onRevealPassword}
          title={onRevealPassword ? undefined : NOT_CONNECTED}
          className={cn(FIELD, 'inline-flex items-center gap-2 font-medium transition-colors hover:bg-ui-hover-bg disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-ui-hover-bg')}
        >
          {showInfo ? 'Hide Info' : 'Show Info'}
          {showInfo ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </button>
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-[var(--status-t10-fg)] bg-[var(--status-t10-bg)] px-4 py-3 text-[13px] text-[var(--status-t10-fg)]">
          {error}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-[11px] border border-dashed border-primary-300 px-6 py-14 text-center dark:border-primary-600">
          <p className="m-0 text-[15px] font-semibold text-secondary-700 dark:text-primary-50">
            {tab === 'active' ? 'No active subscriptions' : 'No cancelled subscriptions'}
          </p>
          <p className="m-0 text-[13px] text-ui-body">
            {subscriptions.length === 0 ? 'Company software subscriptions will show up here.' : 'Nothing matches these filters.'}
          </p>
        </div>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-4">
          {visible.map(s => (
            <li key={s.id} className="min-w-0">
              <SubscriptionCard sub={s} showInfo={showInfo} onRevealPassword={onRevealPassword} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
