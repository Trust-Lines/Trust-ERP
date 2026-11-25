'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowDownUp, Ellipsis, Eye, EyeOff, LayoutGrid, Pencil, Plus, Rows3, Search, Trash2, UserRound } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/modal';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import {
  CURRENCY_OPTIONS, EMPTY_SUBSCRIPTION, ItSubscriptionFormDialog, formatDay,
  type BillingCycle, type Currency, type ItSubscriptionFormValues, type SubscriptionUser,
} from './ItSubscriptionFormDialog';
import { PageHeading } from '@/components/platform/shared/PageHeading';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TOOLBAR_SELECT, TOOLBAR_SORT_ICON } from './ticketStyles';
import { FIELD, MUTED, STRONG, SecretField, copyText, initials, tabClass } from './itCardParts';

// Figma "New Subscription" (1141:14764): the company's software subscriptions grouped by service —
// a grey band with the service logo and name, then its cards four across: logo, name, FULL / "N
// Seats Available" against the maximum users, the login address, the price with Monthly / Yearly,
// and Next renewal, Used Card, Used by. Toolbar: search, sort, service, card and seat filters, Grouped / Cards view, and
// Show Info (reveals the passwords on the cards).
//
// Data: it_subscriptions (159, billing 162) and it_subscription_users (160, teams 162) via
// lib/it/subscriptions. edit.it adds / edits / deletes and reveals passwords (fetched one at a
// time, audited, never sent with the list). Only the card's last four digits are stored.

export interface ItSubscription {
  id: string;
  service: string;
  loginEmail: string;
  logoUrl: string | null;
  /** Maximum users; null = no limit. */
  seats: number | null;
  /** Who uses it: people in the system, typed names (personId null) or teams (teamSize). */
  users: SubscriptionUser[];
  cardLast4: string | null;
  amount: number | null;
  currency: Currency | null;
  billingCycle: BillingCycle | null;
  /** ISO dates. */
  startDate: string | null;
  dueDate: string | null;
  /** false = cancelled, listed under History. */
  active: boolean;
  /** ISO timestamp, used by the sort. */
  createdAt: string;
  notes?: string | null;
  hasPassword?: boolean;
}

type Tab = 'active' | 'history';
type Sort = 'newest' | 'oldest' | 'name' | 'renewal';
type Seats = '' | 'full' | 'available';

const NOT_CONNECTED = 'Needs IT edit rights';
const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'renewal', label: 'Next renewal' },
];
const SEAT_OPTIONS = [
  { value: '', label: 'Seat Availability' },
  { value: 'available', label: 'Seats available' },
  { value: 'full', label: 'Full' },
];
const DUE_SOON_DAYS = 30;
/** Figma "main surfaces + cards" grey. */
const SURFACE = 'bg-primary-50 dark:bg-primary-700';
const VALUE_CHIP = cn('inline-flex h-5 max-w-full shrink-0 items-center gap-1 overflow-hidden whitespace-nowrap rounded-[3px] px-2.5 text-[14px] font-semibold leading-[1.4]', SURFACE, STRONG);
/** Value side of a row: up to two thirds of the card, so a long name truncates instead of the label. */
const VALUE_CELL = 'm-0 flex min-w-0 max-w-[66%] justify-end';
type View = 'grouped' | 'cards';
const GRID = 'm-0 grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';
const VIEW_KEY = 'it.subscriptions.view';

async function revealPassword(id: string): Promise<string> {
  const res = await fetch(`/api/it/subscriptions/${id}/secret`, { cache: 'no-store' });
  const b = await res.json().catch(() => null) as { value?: string; error?: string } | null;
  if (!res.ok || typeof b?.value !== 'string') throw new Error(b?.error ?? 'Could not load');
  return b.value;
}

const toForm = (s: ItSubscription): ItSubscriptionFormValues => ({
  id: s.id, service: s.service, loginEmail: s.loginEmail, logoUrl: s.logoUrl ?? '',
  amount: s.amount != null ? String(s.amount) : '', currency: s.currency ?? 'USD', billingCycle: s.billingCycle ?? 'monthly',
  cardLast4: s.cardLast4 ?? '', startDate: s.startDate ?? '', dueDate: s.dueDate ?? '',
  seats: s.seats != null ? String(s.seats) : '', notes: s.notes ?? '', users: s.users, active: s.active, hasPassword: s.hasPassword,
});

/** Seats taken: one per person or name, a team counts its head count. */
const usedSeats = (users: SubscriptionUser[]) => users.reduce((n, u) => n + (u.teamSize && u.teamSize > 0 ? u.teamSize : 1), 0);
/** null = no limit set. */
function seatState(sub: ItSubscription): { full: boolean; free: number } | null {
  if (sub.seats == null) return null;
  const free = sub.seats - usedSeats(sub.users);
  return { full: free <= 0, free: Math.max(0, free) };
}

const day = (iso: string | null) => (iso ? formatDay(new Date(`${iso.slice(0, 10)}T00:00:00`)) : '—');
/** Due date is red when it has passed or is within 30 days. */
function isDueSoon(iso: string | null) {
  if (!iso) return false;
  return new Date(`${iso.slice(0, 10)}T00:00:00`).getTime() - Date.now() <= DUE_SOON_DAYS * 86_400_000;
}
/** "$ 100", "€ 12.50". */
function price(sub: ItSubscription) {
  if (sub.amount == null) return '—';
  const symbol = CURRENCY_OPTIONS.find(c => c.value === (sub.currency ?? 'USD'))?.symbol ?? '$';
  const n = Number.isInteger(sub.amount) ? String(sub.amount) : sub.amount.toFixed(2);
  return `${symbol} ${n}`;
}

function Logo({ name, url }: { name: string; url: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <span className="text-[14px] font-semibold text-secondary-700">{initials(name)}</span>;
  // eslint-disable-next-line @next/next/no-img-element -- service logos come from arbitrary hosts
  return <img src={url} alt="" onError={() => setFailed(true)} className="max-h-full max-w-full object-contain" />;
}

function SeatBadge({ sub }: { sub: ItSubscription }) {
  const s = seatState(sub);
  if (!s) return null;
  return s.full ? (
    <span className="shrink-0 rounded-[3px] bg-[var(--status-t10-bg)] px-2 py-px text-[10px] font-semibold leading-[1.4] text-[var(--status-t10-fg)]">FULL</span>
  ) : (
    <span className="shrink-0 rounded-[3px] bg-[var(--status-t9-bg)] px-2 py-px text-[10px] font-semibold leading-[1.4] text-[var(--status-t9-fg)]">
      {s.free} Seat{s.free === 1 ? '' : 's'} Available
    </span>
  );
}

/** "T Lines", "Team Syria", or "3 Users" when more than one is listed. */
function UsedBy({ users }: { users: SubscriptionUser[] }) {
  const names = users.map(u => (u.teamSize != null ? `${u.name} (${u.teamSize})` : u.name)).join(', ');
  if (!users.length) return <span className={VALUE_CHIP}>—</span>;
  if (users.length === 1) return <span className={VALUE_CHIP} title={names}><span className="truncate">{users[0].name}</span></span>;
  const n = usedSeats(users);
  return (
    <span className={VALUE_CHIP} title={names}>
      <UserRound size={14} aria-hidden />{n} Users<span className="sr-only">: {names}</span>
    </span>
  );
}

function SubscriptionCard({ sub, showInfo, onRevealPassword, onEdit, onDelete }: {
  sub: ItSubscription;
  showInfo: boolean;
  onRevealPassword?: (id: string) => Promise<string>;
  onEdit?: (sub: ItSubscription) => void;
  onDelete?: (sub: ItSubscription) => void;
}) {
  const dueSoon = sub.active && isDueSoon(sub.dueDate);
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-[16px] border border-ui-divider bg-ui-surface-elevated px-4 pb-4 pt-[14px]">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-[45px] shrink-0 place-items-center overflow-hidden rounded-[8px] border border-ui-divider bg-white p-1">
          <Logo name={sub.service} url={sub.logoUrl} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className={cn('m-0 truncate text-[16px] font-semibold leading-5', STRONG)}>{sub.service}</h3>
            <SeatBadge sub={sub} />
          </div>
          <p className="m-0 truncate text-[12px] font-medium leading-4 tracking-[0.36px] text-ui-body opacity-50 dark:opacity-80">{sub.loginEmail || '—'}</p>
        </div>
        <Menu>
          <MenuTrigger render={
            <button type="button" aria-label={`Actions for ${sub.service}`}
              className={cn('grid size-[37px] shrink-0 place-items-center rounded-[8px] border border-ui-divider hover:bg-ui-hover-bg focus-visible:outline-2 focus-visible:outline-ui-focus-ring', STRONG)} />
          }>
            <Ellipsis size={23} aria-hidden />
          </MenuTrigger>
          <MenuContent>
            {sub.loginEmail && <MenuItem onClick={() => void copyText(sub.loginEmail, 'Email')}>Copy email</MenuItem>}
            {onEdit && <MenuItem onClick={() => onEdit(sub)}><Pencil aria-hidden /> Edit</MenuItem>}
            {onDelete && <MenuItem onClick={() => onDelete(sub)}><Trash2 aria-hidden /> Delete</MenuItem>}
          </MenuContent>
        </Menu>
      </div>

      <div className={cn('flex items-center gap-1 rounded-[6px] py-1.5 pl-2.5 pr-1.5', SURFACE)}>
        <span className={cn('min-w-0 flex-1 truncate text-[20px] font-semibold leading-[1.4]', STRONG)}>{price(sub)}</span>
        {sub.billingCycle && (
          <span className={cn('shrink-0 rounded-[6px] bg-ui-surface-elevated px-2.5 py-1.5 text-[11px] font-semibold leading-[1.4]', STRONG)}>
            {sub.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}
          </span>
        )}
      </div>

      {showInfo && <SecretField id={sub.id} label={sub.service} showInfo={showInfo} onReveal={onRevealPassword} notConnectedTitle={NOT_CONNECTED} />}

      <div className="border-t border-dashed border-ui-divider" />

      <dl className={cn('m-0 flex flex-col gap-2 text-[14px] leading-[1.4]', STRONG)}>
        <div className="flex items-start justify-between gap-2">
          <dt className="font-semibold">Next renewal</dt>
          <dd className={cn('m-0 font-medium', dueSoon && 'text-error-normal')}>{day(sub.dueDate)}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="font-semibold">Used Card</dt>
          <dd className={VALUE_CELL}>
            <span className={VALUE_CHIP}>{sub.cardLast4 ? <><span aria-hidden>**** </span><span className="sr-only">ending in </span>{sub.cardLast4}</> : '—'}</span>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="font-semibold">Used by</dt>
          <dd className={VALUE_CELL}><UsedBy users={sub.users} /></dd>
        </div>
      </dl>
    </article>
  );
}

export function ItSubscriptionsClient({ subscriptions, error = null, canCreate = false, people = [] }: {
  subscriptions: ItSubscription[];
  /** Active staff for the form's user picker. */
  people?: { id: string; name: string; role?: string | null }[];
  error?: string | null;
  /** edit.it: add, edit, delete and show passwords. */
  canCreate?: boolean;
}) {
  const router = useRouter();
  const onRevealPassword = canCreate ? revealPassword : undefined;
  const [form, setForm] = useState<ItSubscriptionFormValues | null>(null);
  const [deleting, setDeleting] = useState<ItSubscription | null>(null);
  const [tab, setTab] = useState<Tab>('active');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [service, setService] = useState('');
  const [card, setCard] = useState('');
  const [seats, setSeats] = useState<Seats>('');
  const [showInfo, setShowInfo] = useState(false);
  // Grouped = a band per service; Cards = all cards side by side. Remembered per browser.
  const [view, setView] = useState<View>('grouped');
  useEffect(() => {
    try { const v = localStorage.getItem(VIEW_KEY); if (v === 'grouped' || v === 'cards') setView(v); } catch { /* storage blocked */ }
  }, []);
  const changeView = (v: View) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage blocked */ } };

  const activeCount = useMemo(() => subscriptions.filter(s => s.active).length, [subscriptions]);
  const serviceOptions = useMemo(() => {
    const names = [...new Set(subscriptions.map(s => s.service).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return [{ value: '', label: 'All Subscriptions' }, ...names.map(n => ({ value: n, label: n }))];
  }, [subscriptions]);
  const cardOptions = useMemo(() => {
    const cards = [...new Set(subscriptions.map(s => s.cardLast4).filter((v): v is string => !!v))].sort();
    return [{ value: '', label: 'Card' }, ...cards.map(c => ({ value: c, label: `**** ${c}` }))];
  }, [subscriptions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = subscriptions
      .filter(s => s.active === (tab === 'active'))
      .filter(s => !service || s.service === service)
      .filter(s => !card || s.cardLast4 === card)
      .filter(s => {
        if (!seats) return true;
        const st = seatState(s);
        return seats === 'full' ? !!st?.full : !st?.full;
      })
      .filter(s => !q || `${s.service} ${s.loginEmail} ${s.cardLast4 ?? ''} ${s.users.map(u => u.name).join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === 'name') return a.service.localeCompare(b.service);
        if (sort === 'renewal') return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
        const diff = Date.parse(a.createdAt) - Date.parse(b.createdAt);
        return sort === 'newest' ? -diff : diff;
      });
    // One band per service, in the order its first card sorts.
    const map = new Map<string, { name: string; logoUrl: string | null; subs: ItSubscription[] }>();
    for (const s of list) {
      const key = s.service.trim().toLowerCase();
      const g = map.get(key) ?? { name: s.service, logoUrl: null, subs: [] };
      g.subs.push(s);
      g.logoUrl ??= s.logoUrl;
      map.set(key, g);
    }
    return { list, groups: [...map.values()] };
  }, [subscriptions, tab, service, card, seats, query, sort]);
  const { list: visible, groups } = filtered;

  return (
    <div className="flex w-full flex-col gap-[30px] p-7 font-ui">
      <PageHeading
        trail={[{ label: 'IT', href: '/it/tickets' }, { label: 'Subscriptions', href: '/it/subscriptions' }]}
        title="Subscriptions"
        subtitle="Subscription Management"
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
            onClick={() => setForm(EMPTY_SUBSCRIPTION)}
            title={canCreate ? undefined : NOT_CONNECTED}
            className="flex h-9 items-center gap-2 rounded-md bg-accent-400 px-3 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-950"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            New Subscriptions
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
            <Select aria-label="Sort subscriptions" className={cn(TOOLBAR_SELECT, 'pl-[34px] dark:pl-[34px]')}
              value={sort} onValueChange={v => setSort((v ?? 'newest') as Sort)} options={SORTS} />
          </div>
          <Select aria-label="Filter by service" className={cn(TOOLBAR_SELECT, 'pl-3 dark:pl-3')}
            value={service} onValueChange={v => setService(v ?? '')} options={serviceOptions} />
          <Select aria-label="Filter by card" className={cn(TOOLBAR_SELECT, 'pl-3 dark:pl-3')}
            value={card} onValueChange={v => setCard(v ?? '')} options={cardOptions} />
          <Select aria-label="Filter by seat availability" className={cn(TOOLBAR_SELECT, 'pl-3 dark:pl-3')}
            value={seats} onValueChange={v => setSeats((v ?? '') as Seats)} options={SEAT_OPTIONS} />
        </div>
        <div className="flex items-center gap-2.5">
        <div role="group" aria-label="View" className="flex h-10 items-center gap-1 rounded-md border border-primary-200 bg-white p-1 dark:border-secondary-500 dark:bg-primary-800">
          {([['grouped', 'Grouped by service', Rows3], ['cards', 'Cards side by side', LayoutGrid]] as const).map(([v, label, Icon]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => changeView(v)} title={label} aria-label={label}
              className={cn('grid h-8 w-8 place-items-center rounded-[4px] transition-colors focus-visible:outline-2 focus-visible:outline-ui-focus-ring',
                view === v ? 'bg-secondary-700 text-white dark:bg-secondary-50 dark:text-primary-950' : cn('hover:bg-ui-hover-bg', STRONG))}>
              <Icon size={16} aria-hidden />
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={showInfo}
          onClick={() => setShowInfo(s => !s)}
          disabled={!onRevealPassword}
          title={onRevealPassword ? 'Show the saved passwords on the cards' : NOT_CONNECTED}
          className={cn(FIELD, 'inline-flex items-center gap-2 font-medium transition-colors hover:bg-ui-hover-bg disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-ui-hover-bg')}
        >
          {showInfo ? 'Hide Info' : 'Show Info'}
          {showInfo ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </button>
        </div>
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
      ) : view === 'cards' ? (
        <ul className={GRID}>
          {visible.map(s => (
            <li key={s.id} className="min-w-0">
                <SubscriptionCard sub={s} showInfo={showInfo} onRevealPassword={onRevealPassword}
                  onEdit={canCreate ? sub => setForm(toForm(sub)) : undefined} onDelete={canCreate ? setDeleting : undefined} />
              </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map(g => (
            <section key={g.name.toLowerCase()} className="flex flex-col gap-2" aria-label={g.name}>
              <div className={cn('flex items-center gap-[18px] rounded-[16px] px-4 pb-4 pt-[14px]', SURFACE)}>
                <span className="grid size-[45px] shrink-0 place-items-center overflow-hidden rounded-[8px] bg-white p-1">
                  <Logo name={g.name} url={g.logoUrl} />
                </span>
                <h2 className={cn('m-0 truncate text-[24px] font-semibold leading-5', STRONG)}>{g.name}</h2>
              </div>
              <ul className={GRID}>
                {g.subs.map(s => (
                  <li key={s.id} className="min-w-0">
                    <SubscriptionCard sub={s} showInfo={showInfo} onRevealPassword={onRevealPassword}
                      onEdit={canCreate ? sub => setForm(toForm(sub)) : undefined} onDelete={canCreate ? setDeleting : undefined} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {form && (
        <ItSubscriptionFormDialog
          initial={form} people={people} onClose={() => setForm(null)} onSaved={() => { setForm(null); router.refresh(); }}
          onDelete={form.id ? () => {
            const sub = subscriptions.find(s => s.id === form.id) ?? null;
            setForm(null);
            setDeleting(sub);
          } : undefined}
        />
      )}
      <ConfirmModal
        open={!!deleting} onOpenChange={o => { if (!o) setDeleting(null); }} tone="destructive" confirmLabel="Delete subscription"
        title={`Delete ${deleting?.service ?? 'this subscription'}?`}
        warning="It is removed from the IT list with its saved password. To keep it on record, mark it Cancelled in Edit instead."
        onConfirm={async () => {
          if (!deleting) return;
          const res = await fetch(`/api/it/subscriptions/${deleting.id}`, { method: 'DELETE' });
          if (!res.ok) { toast.error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Could not delete'); throw new Error('kept'); }
          toast.success('Subscription deleted');
          setDeleting(null);
          router.refresh();
        }}
      />
    </div>
  );
}
