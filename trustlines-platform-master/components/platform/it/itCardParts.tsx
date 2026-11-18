'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Copy, Ellipsis, Lock } from 'lucide-react';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Shared pieces of the IT account cards (Figma "IT / Mails" 879:12933, "IT / Subscriptions" 908:22728):
// toolbar field styles, the card header (picture, title, address, "…" menu) and the masked
// password row with its copy button.

export const FIELD =
  'h-10 rounded-md border border-primary-200 bg-white px-3 text-[13px] font-ui text-secondary-700 outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring dark:border-secondary-500 dark:bg-primary-800 dark:text-secondary-50';
export const MUTED = 'text-primary-400 dark:text-primary-200';
export const STRONG = 'text-secondary-700 dark:text-secondary-50';
export const CARD = 'flex min-w-0 flex-col gap-4 rounded-[8px] border border-ui-divider bg-ui-surface p-4';
const MASK = '••••••••••••••••';

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name', label: 'Name A–Z' },
];

export const initials = (name: string) => name.split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

export async function copyText(text: string, what: string) {
  try { await navigator.clipboard.writeText(text); toast.success(`${what} copied`); }
  catch { toast.error('Could not copy'); }
}

/** Active / History tab button style (same as IT Tickets). */
export const tabClass = (on: boolean) =>
  cn(
    'flex h-full items-center border-b-[3px] border-solid text-[13px] transition-colors',
    on
      ? 'border-secondary-700 font-semibold text-secondary-700 dark:border-secondary-50 dark:text-secondary-50'
      : cn('border-transparent hover:text-secondary-700 dark:hover:text-secondary-50', MUTED),
  );

/** Card header: 45px picture, 20px title, address under it, and a "…" menu with "Copy email". */
export function CardHead({ picture, title, titleStyle, email }: {
  picture: ReactNode;
  title: string;
  /** Brand colour for the title (subscriptions); defaults to the heading colour. */
  titleStyle?: React.CSSProperties;
  email: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="grid size-[45px] shrink-0 place-items-center overflow-hidden rounded-[6px] bg-primary-100 text-[14px] font-semibold text-secondary-700 dark:bg-primary-700 dark:text-secondary-50">
        {picture}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className={cn('m-0 truncate text-[20px] font-semibold leading-5', !titleStyle && STRONG)} style={titleStyle}>{title}</h3>
        <p className="m-0 truncate text-[14px] font-medium leading-4 tracking-[0.42px] text-ui-body dark:text-primary-50">{email}</p>
      </div>
      <Menu>
        <MenuTrigger render={<Button variant="ghost" size="icon-sm" className={cn('self-start', STRONG)} aria-label={`Actions for ${title}`} />}>
          <Ellipsis aria-hidden />
        </MenuTrigger>
        <MenuContent>
          <MenuItem onClick={() => void copyText(email, 'Email')}>Copy email</MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

/**
 * Masked password row with a copy button. The password is never part of the list: it is fetched
 * once, on demand, through `onReveal` (when "Show Info" is on, or on copy). Without `onReveal` the
 * copy button is disabled and shows `notConnectedTitle`.
 */
export function SecretField({ id, label, showInfo, onReveal, notConnectedTitle }: {
  id: string;
  label: string;
  showInfo: boolean;
  onReveal?: (id: string) => Promise<string>;
  notConnectedTitle: string;
}) {
  const [secret, setSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!showInfo || !onReveal || secret) return;
    let live = true;
    setLoading(true);
    onReveal(id)
      .then(p => { if (live) setSecret(p); })
      .catch(() => { if (live) toast.error('Could not load the password'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [showInfo, onReveal, secret, id]);

  async function copy() {
    if (!onReveal) return;
    let p = secret;
    if (!p) {
      setLoading(true);
      try { p = await onReveal(id); setSecret(p); }
      catch { toast.error('Could not load the password'); return; }
      finally { setLoading(false); }
    }
    await copyText(p, 'Password');
  }

  return (
    <div className="flex items-center gap-1 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg py-1.5 pl-2 pr-[5px]">
      <Lock size={16} aria-hidden className={cn('shrink-0', STRONG)} />
      <span className={cn('min-w-0 flex-1 truncate text-[14px] leading-[1.4]', STRONG)}>
        <span className="sr-only">Password: </span>{loading ? 'Loading…' : showInfo && secret ? secret : MASK}
      </span>
      <button
        type="button"
        onClick={copy}
        disabled={!onReveal || loading}
        aria-label={`Copy password for ${label}`}
        title={onReveal ? 'Copy password' : notConnectedTitle}
        className="grid size-[26px] shrink-0 place-items-center rounded-[4px] bg-secondary-700 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-50 dark:text-primary-950"
      >
        <Copy size={14} aria-hidden />
      </button>
    </div>
  );
}
