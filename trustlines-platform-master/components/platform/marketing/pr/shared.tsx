'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { platformLabel } from '@/lib/marketing/prWorkspace';

// Shared pieces of the Marketing & PR workspace (Social Media, Calendar). Same Figma styling
// as Marketing Home / Trash: secondary-700 headings, ui-* surface tokens, 10px panels.

export const HEADING_TEXT = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
export const PANEL = 'rounded-[10px] border border-ui-divider bg-ui-surface-elevated';
export const TH_CLS = 'whitespace-nowrap px-2.5 py-2.5 text-left text-[12px] font-medium text-ui-text-secondary first:pl-3 last:pr-3';
export const TD_CLS = 'px-2.5 py-3 align-middle text-[12px] leading-[1.45] text-ui-body first:pl-3 last:pr-3';

export function PageHeading({ trail, title, subtitle, actions }: { trail: string; title: string; subtitle: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <p className="m-0 text-[11px] font-semibold text-ui-nav-active">{trail}</p>
        <h1 className={cn('m-0 text-[28px] font-semibold leading-[1.35]', HEADING_TEXT)}>{title}</h1>
        <p className="m-0 text-[13px] text-ui-body">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Label + control + optional hint, the form row used in every PR workspace dialog. */
export function Field({ label, htmlFor, hint, className, children }: { label: string; htmlFor?: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="text-[12px] font-medium text-ui-body">{label}</label>
      {children}
      {hint && <span className="text-[11px] text-ui-text-secondary">{hint}</span>}
    </div>
  );
}

// No brand logos in the installed lucide-react (1.x removed them), so each platform gets a
// short mark in its brand colour.
const PLATFORM_MARK: Record<string, { text: string; bg: string }> = {
  instagram: { text: 'IG', bg: '#C13584' },
  facebook: { text: 'f', bg: '#1877F2' },
  linkedin: { text: 'in', bg: '#0A66C2' },
  x: { text: 'X', bg: '#111111' },
  youtube: { text: 'YT', bg: '#E00000' },
  tiktok: { text: 'TT', bg: '#111111' },
  other: { text: '•', bg: '#64748B' },
};

export function PlatformMark({ platform, size = 24 }: { platform: string; size?: number }) {
  const m = PLATFORM_MARK[platform] ?? PLATFORM_MARK.other;
  return (
    <span
      role="img"
      aria-label={platformLabel(platform)}
      className="inline-grid shrink-0 place-items-center rounded-[6px] font-bold text-white"
      style={{ width: size, height: size, background: m.bg, fontSize: Math.round(size * 0.42) }}
    >
      {m.text}
    </span>
  );
}

export const NUMBER = new Intl.NumberFormat('en-US');
export const fmtNumber = (n: number | null | undefined) => (n === null || n === undefined ? '—' : NUMBER.format(n));

const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
/** YYYY-MM-DD → "Oct 27, 2026" without time-zone drift (DATE columns). */
export const fmtDay = (iso: string | null | undefined) => (iso ? DAY.format(new Date(`${iso}T00:00:00Z`)) : '—');

/** Today in the viewer's own time zone, as YYYY-MM-DD. Call it after mount, not during SSR. */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Sends JSON to a PR workspace route and returns the body, throwing the server's message on failure. */
export async function sendJson<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Something went wrong — please try again.');
  return data as T;
}
