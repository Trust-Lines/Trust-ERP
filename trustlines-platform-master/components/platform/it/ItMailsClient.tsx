'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDownUp, Copy, Ellipsis, Eye, EyeOff, Lock, Mail, Plus, Search } from 'lucide-react';
import { PageHeading } from '@/components/platform/shared/PageHeading';
import { PersonFace } from '@/components/ui/avatar-directory';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TOOLBAR_SELECT, TOOLBAR_SORT_ICON } from './ticketStyles';

// Figma "IT / Mails" (879:12933): company mailboxes, one card each — owner photo, name, address,
// and the mailbox password (masked, copy button). Active / History tabs, search, sort, user filter,
// and "Show Info" to reveal passwords.
//
// There is no mailbox data source yet, so the page passes an empty list. Passwords are never part
// of the list: when the backend exists, reveal / copy should fetch one password on demand
// (authorised and audited) through `onRevealPassword`. Until then those controls are disabled.

export interface ItMailAccount {
  id: string;
  email: string;
  ownerId: string | null;
  ownerName: string;
  /** false = closed mailbox, listed under History. */
  active: boolean;
  /** ISO timestamp, used by the sort. */
  createdAt: string;
}

type Tab = 'active' | 'history';
type Sort = 'newest' | 'oldest' | 'name';

const NOT_CONNECTED = 'Not available yet: the mailbox data source is not connected';
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name', label: 'Name A–Z' },
];
const FIELD =
  'h-10 rounded-md border border-primary-200 bg-white px-3 text-[13px] font-ui text-secondary-700 outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring dark:border-secondary-500 dark:bg-primary-800 dark:text-secondary-50';
const MUTED = 'text-primary-400 dark:text-primary-200';
const STRONG = 'text-secondary-700 dark:text-secondary-50';
const MASK = '••••••••••••••••';

const initials = (name: string) => name.split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

async function copyText(text: string, what: string) {
  try { await navigator.clipboard.writeText(text); toast.success(`${what} copied`); }
  catch { toast.error('Could not copy'); }
}

function MailCard({ account, showInfo, onRevealPassword }: {
  account: ItMailAccount;
  showInfo: boolean;
  onRevealPassword?: (id: string) => Promise<string>;
}) {
  const [password, setPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchPassword() {
    if (!onRevealPassword) return null;
    if (password) return password;
    setLoading(true);
    try { const p = await onRevealPassword(account.id); setPassword(p); return p; }
    catch { toast.error('Could not load the password'); return null; }
    finally { setLoading(false); }
  }

  async function copyPassword() {
    const p = await fetchPassword();
    if (p) await copyText(p, 'Password');
  }

  // "Show Info" on: load this mailbox's password once (on demand, never part of the list).
  useEffect(() => {
    if (!showInfo || !onRevealPassword || password) return;
    let live = true;
    setLoading(true);
    onRevealPassword(account.id)
      .then(p => { if (live) setPassword(p); })
      .catch(() => { if (live) toast.error('Could not load the password'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [showInfo, onRevealPassword, password, account.id]);

  const shown = showInfo && password ? password : MASK;

  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-[8px] border border-ui-divider bg-ui-surface p-4">
      <div className="flex min-w-0 items-center gap-2">
        <div className="grid size-[45px] shrink-0 place-items-center overflow-hidden rounded-[6px] bg-primary-100 text-[14px] font-semibold text-secondary-700 dark:bg-primary-700 dark:text-secondary-50">
          <PersonFace name={account.ownerName} userId={account.ownerId} fallback={initials(account.ownerName) || <Mail size={18} aria-hidden />} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className={cn('m-0 truncate text-[20px] font-semibold leading-5', STRONG)}>{account.ownerName}</h3>
          <p className="m-0 truncate text-[14px] font-medium leading-4 tracking-[0.42px] text-ui-body dark:text-primary-50">{account.email}</p>
        </div>
        <Menu>
          <MenuTrigger render={<Button variant="ghost" size="icon-sm" className={cn('self-start', STRONG)} aria-label={`Actions for ${account.email}`} />}>
            <Ellipsis aria-hidden />
          </MenuTrigger>
          <MenuContent>
            <MenuItem onClick={() => void copyText(account.email, 'Email')}>Copy email</MenuItem>
          </MenuContent>
        </Menu>
      </div>

      <div className="flex items-center gap-1 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg py-1.5 pl-2 pr-[5px]">
        <Lock size={16} aria-hidden className={cn('shrink-0', STRONG)} />
        <span className={cn('min-w-0 flex-1 truncate text-[14px] leading-[1.4]', STRONG)}>
          <span className="sr-only">Password: </span>{loading ? 'Loading…' : shown}
        </span>
        <button
          type="button"
          onClick={copyPassword}
          disabled={!onRevealPassword || loading}
          aria-label={`Copy password for ${account.email}`}
          title={onRevealPassword ? 'Copy password' : NOT_CONNECTED}
          className="grid size-[26px] shrink-0 place-items-center rounded-[4px] bg-secondary-700 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-50 dark:text-primary-950"
        >
          <Copy size={14} aria-hidden />
        </button>
      </div>
    </article>
  );
}

export function ItMailsClient({ accounts, error = null, canCreate = false, onRevealPassword }: {
  accounts: ItMailAccount[];
  error?: string | null;
  canCreate?: boolean;
  onRevealPassword?: (id: string) => Promise<string>;
}) {
  const [tab, setTab] = useState<Tab>('active');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [owner, setOwner] = useState('');
  const [showInfo, setShowInfo] = useState(false);

  const activeCount = useMemo(() => accounts.filter(a => a.active).length, [accounts]);
  const ownerOptions = useMemo(() => {
    const names = [...new Set(accounts.map(a => a.ownerName).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return [{ value: '', label: 'All users' }, ...names.map(n => ({ value: n, label: n }))];
  }, [accounts]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts
      .filter(a => a.active === (tab === 'active'))
      .filter(a => !owner || a.ownerName === owner)
      .filter(a => !q || `${a.ownerName} ${a.email}`.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === 'name') return a.ownerName.localeCompare(b.ownerName);
        const diff = Date.parse(a.createdAt) - Date.parse(b.createdAt);
        return sort === 'newest' ? -diff : diff;
      });
  }, [accounts, tab, owner, query, sort]);

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
        trail={[{ label: 'IT', href: '/it/tickets' }, { label: 'Mails', href: '/it/mails' }]}
        title="Mails"
        subtitle="Company mailboxes"
        bodyClassName="gap-2"
        titleAdornment={
          <span className="rounded-full bg-primary-50 px-[9px] py-[3px] text-[12px] font-semibold leading-[1.4] text-secondary-700 dark:bg-primary-700 dark:text-secondary-50">
            <span className="sr-only">Active mailboxes: </span>{activeCount}
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
            New Email
          </button>
        }
      />

      <div role="tablist" aria-label="Mailbox views" className="flex h-12 items-stretch gap-8 border-b border-solid border-primary-100 dark:border-primary-600">
        <button role="tab" type="button" aria-selected={tab === 'active'} onClick={() => setTab('active')} className={tabClass(tab === 'active')}>
          Active Mails
        </button>
        <button role="tab" type="button" aria-selected={tab === 'history'} onClick={() => setTab('history')} className={tabClass(tab === 'history')}>
          History
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="relative flex w-[380px] max-w-full items-center">
            <Search className={cn('pointer-events-none absolute left-3 h-4 w-4', MUTED)} strokeWidth={1.5} aria-hidden="true" />
            <span className="sr-only">Search mailboxes</span>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search mails…"
              className={cn(FIELD, 'w-full pl-9 placeholder:text-primary-400 dark:placeholder:text-primary-200')}
            />
          </label>
          <div className="relative">
            <ArrowDownUp aria-hidden="true" className={TOOLBAR_SORT_ICON} />
            <Select
              aria-label="Sort mailboxes"
              className={cn(TOOLBAR_SELECT, 'pl-[34px] dark:pl-[34px]')}
              value={sort}
              onValueChange={v => setSort((v ?? 'newest') as Sort)}
              options={SORT_OPTIONS}
            />
          </div>
          <Select
            aria-label="Filter by user"
            className={cn(TOOLBAR_SELECT, 'pl-3 dark:pl-3')}
            value={owner}
            onValueChange={v => setOwner(v ?? '')}
            options={ownerOptions}
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
            {tab === 'active' ? 'No active mailboxes' : 'No closed mailboxes'}
          </p>
          <p className="m-0 text-[13px] text-ui-body">
            {accounts.length === 0 ? 'Company mailboxes will show up here.' : 'Nothing matches these filters.'}
          </p>
        </div>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-4">
          {visible.map(a => (
            <li key={a.id} className="min-w-0">
              <MailCard account={a} showInfo={showInfo} onRevealPassword={onRevealPassword} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
