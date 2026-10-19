'use client';

import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { THEME_EVENT, THEME_KEY, applyTheme, readThemePreference, writeThemePreference, type ThemePreference } from '@/lib/theme/theme';

/**
 * Mounted once in the root layout. Keeps the `dark` class in step with the saved choice:
 * follows the OS when set to "System", and syncs other open tabs.
 */
export function ThemeSync() {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => applyTheme(readThemePreference());
    const onStorage = (e: StorageEvent) => { if (e.key === THEME_KEY) sync(); };
    sync();
    media.addEventListener('change', sync);
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      media.removeEventListener('change', sync);
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return null;
}

/** Current preference, updated when it changes anywhere. */
export function useThemePreference(): ThemePreference {
  const [pref, setPref] = useState<ThemePreference>('system');
  useEffect(() => {
    const sync = () => setPref(readThemePreference());
    sync();
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);
  return pref;
}

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/**
 * Light / Dark / System segmented control.
 * tone "onDark" is for the always-dark sidebar menu; "default" follows the page theme.
 */
export function ThemeSwitch({ tone = 'default', className = '' }: { tone?: 'default' | 'onDark'; className?: string }) {
  const pref = useThemePreference();
  const wrap = tone === 'onDark'
    ? 'bg-white/10'
    : 'bg-[var(--bg-subtle)] border border-[var(--border-default)]';
  const item = (active: boolean) => tone === 'onDark'
    ? (active ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white')
    : (active ? 'bg-[var(--bg-surface)] text-[var(--fg-default)] shadow-xs' : 'text-[var(--fg-subtle)] hover:text-[var(--fg-default)]');

  return (
    <div role="radiogroup" aria-label="Theme" className={`grid grid-cols-3 gap-0.5 rounded-lg p-0.5 ${wrap} ${className}`}>
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          title={label}
          onClick={() => writeThemePreference(value)}
          className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors ${item(pref === value)}`}
        >
          <Icon size={12} aria-hidden className="shrink-0" />
          <span className="truncate">{label}</span>
        </button>
      ))}
    </div>
  );
}
