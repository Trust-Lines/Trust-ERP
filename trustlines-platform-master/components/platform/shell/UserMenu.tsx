'use client';

import * as React from 'react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Settings, Shield } from 'lucide-react';
import { ThemeSwitch } from '@/components/platform/shared/ThemeSync';

// Design: Figma "TRUST-LINES ERP" → "Shell (Task 11)" → "User dropdown" (99:12105), light + dark.
export function userInitials(name: string) {
  return (name || 'U').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

const OPTION = 'flex w-full items-center gap-3 rounded-md p-3 text-left text-[13px] leading-[1.4] text-primary-500 transition-colors hover:bg-primary-50 dark:text-primary-100 dark:hover:bg-primary-800';
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
  const ref = useRef<HTMLDivElement>(null);
  const initials = userInitials(userName);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        title={variant === 'rail' ? `${userName} (${roleDisplay})` : undefined}
        className="flex cursor-pointer items-center gap-[9px] rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-700 dark:focus-visible:outline-primary-50"
      >
        <span
          className={`flex items-center justify-center rounded-md bg-secondary-100 text-primary-500 dark:bg-secondary-700 dark:text-primary-100 ${
            variant === 'rail' ? 'h-12 w-12 text-sm font-medium' : 'h-9 w-9 text-xs'
          }`}
        >
          {initials}
        </span>
        {variant === 'topbar' && (
          <ChevronDown className={`h-3 w-3 text-primary-500 transition-transform dark:text-primary-100 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={`z-50 w-72 rounded-xl border border-primary-100 bg-white p-3 shadow-[0_16px_48px_rgba(10,12,15,0.12)] dark:border-primary-600 dark:bg-secondary-800 ${
            variant === 'rail' ? 'fixed bottom-5 left-[80px]' : 'absolute top-full right-0 mt-2'
          }`}
        >
          <div className="flex items-start gap-3 p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-[11px] text-primary-500 dark:bg-secondary-700 dark:text-primary-100">
              {initials}
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

          <Link href="/settings" role="menuitem" onClick={close} className={OPTION}>
            <Settings className={ICON} strokeWidth={1.5} aria-hidden="true" />
            Settings
          </Link>
          <Link href="/audit" role="menuitem" onClick={close} className={OPTION}>
            <Shield className={ICON} strokeWidth={1.5} aria-hidden="true" />
            Audit &amp; Security
          </Link>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" role="menuitem" onClick={clearDocgenDrafts} className={`${OPTION} cursor-pointer`}>
              <LogOut className={ICON} strokeWidth={1.5} aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
