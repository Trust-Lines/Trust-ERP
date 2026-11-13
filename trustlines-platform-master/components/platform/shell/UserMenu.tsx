'use client';

import * as React from 'react';
import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, LogOut, Settings, Shield } from 'lucide-react';
import { ThemeSwitch } from '@/components/platform/shared/ThemeSync';
import { PersonFace } from '@/components/ui/avatar-directory';
import { ViewAsMenuItem } from './ViewAs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Design: Figma "TRUST-LINES ERP" → "Shell (Task 11)" → "User dropdown" (99:12105), light + dark.
export function userInitials(name: string) {
  return (name || 'U').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

// Same hover/focus as the platform's other menus (row menus, Staff, Trust Stock): ui-hover-bg, no custom shade.
const OPTION = 'flex w-full items-center gap-3 rounded-[6px] border-0 bg-transparent p-3 text-left text-[13px] leading-[1.4] text-ui-body no-underline outline-none transition-colors hover:bg-ui-hover-bg hover:text-ui-heading focus-visible:bg-ui-hover-bg focus-visible:ring-2 focus-visible:ring-ui-focus-ring';
const ICON = 'h-4 w-4 shrink-0 text-primary-400 dark:text-primary-200';

function clearDocgenDrafts() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('docgen_')) localStorage.removeItem(k);
    }
  } catch { }
}

/**
 * Avatar trigger + account dropdown. `variant="topbar"` is the 36px square with a chevron that
 * opens downward; `variant="rail"` is the 48px sidebar tile that opens to the right.
 */
export function UserMenu({
  userName,
  userEmail,
  roleDisplay,
  variant,
}: {
  userName: string;
  userEmail: string;
  roleDisplay: string;
  variant: 'topbar' | 'rail';
}) {
  const [open, setOpen] = useState(false);
  const initials = userInitials(userName);

  const close = () => setOpen(false);

  return (
    // Account panel: a Popover (it holds the theme switch and the View-as picker, not only actions).
    // Base UI keeps the View-as dropdown's own popup counted as "inside", so picking a role doesn't close it.
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Account menu"
        title={variant === 'rail' ? `${userName} (${roleDisplay})` : undefined}
        className="flex cursor-pointer items-center gap-[9px] rounded-md border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-700 dark:focus-visible:outline-primary-50"
      >
        <span
          className={`flex items-center justify-center overflow-hidden rounded-md bg-secondary-100 text-primary-500 dark:bg-secondary-700 dark:text-primary-100 ${
            variant === 'rail' ? 'h-12 w-12 text-sm font-medium' : 'h-9 w-9 text-xs'
          }`}
        >
          <PersonFace name={userName} fallback={initials} />
        </span>
        {variant === 'topbar' && (
          <ChevronDown className={`h-3 w-3 text-primary-500 transition-transform dark:text-primary-100 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        )}
      </PopoverTrigger>

      <PopoverContent
        aria-label="Account"
        side={variant === 'rail' ? 'right' : 'bottom'}
        align="end"
        sideOffset={variant === 'rail' ? 12 : 8}
        className="w-72 gap-0 rounded-xl border-primary-100 bg-white p-3 shadow-[0_16px_48px_rgba(10,12,15,0.12)] dark:border-primary-600 dark:bg-secondary-800"
      >
          <div className="flex items-start gap-3 p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary-100 text-[11px] text-primary-500 dark:bg-secondary-700 dark:text-primary-100">
              <PersonFace name={userName} fallback={initials} />
            </span>
            <div className="flex min-w-0 flex-col gap-[3px] leading-[1.4]">
              <p className="truncate text-sm font-semibold text-primary-500 dark:text-primary-100">{userName || 'User'}</p>
              <p className="truncate text-xs text-primary-400 dark:text-primary-200">{userEmail}</p>
              <p className="truncate text-[11px] text-primary-400 dark:text-primary-200">{roleDisplay}</p>
            </div>
          </div>

          <div className="px-3 pt-1 pb-3">
            <p className="mb-1.5 text-[11px] font-medium text-primary-300 dark:text-primary-400">Theme</p>
            <ThemeSwitch className="w-full" />
          </div>

          <ViewAsMenuItem />

          <Link href="/settings" onClick={close} className={OPTION}>
            <Settings className={ICON} strokeWidth={1.5} aria-hidden="true" />
            Settings
          </Link>
          <Link href="/audit" onClick={close} className={OPTION}>
            <Shield className={ICON} strokeWidth={1.5} aria-hidden="true" />
            Audit &amp; Security
          </Link>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" onClick={clearDocgenDrafts} className={`${OPTION} cursor-pointer`}>
              <LogOut className={ICON} strokeWidth={1.5} aria-hidden="true" />
              Sign out
            </button>
          </form>
      </PopoverContent>
    </Popover>
  );
}
