'use client';

import { platformLabel } from '@/lib/marketing/prWorkspace';

// Shared pieces of the Marketing & PR workspace (Social Media, Calendar). Same Figma styling
// as Marketing Home / Trash: secondary-700 headings, ui-* surface tokens, 10px panels.

export const HEADING_TEXT = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
export const PANEL = 'rounded-[10px] border border-ui-divider bg-ui-surface-elevated';
export const TH_CLS = 'whitespace-nowrap px-2.5 py-2.5 text-left text-[12px] font-medium text-ui-text-secondary first:pl-3 last:pr-3';
export const TD_CLS = 'px-2.5 py-3 align-middle text-[12px] leading-[1.45] text-ui-body first:pl-3 last:pr-3';

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

/** Now shared app-wide — see lib/client/fetchJson.ts. Re-exported so existing imports keep working. */
export { sendJson } from '@/lib/client/fetchJson';
