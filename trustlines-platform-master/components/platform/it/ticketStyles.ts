import { Mail, RotateCcw, type LucideIcon } from 'lucide-react';

// Shared IT ticket types and chip styles (Figma "IT Tickets" 828:37587 and "Ticket detail" 828:38141).

export type ItTicketPriority = 'important' | 'medium' | 'low';
export type ItTicketStatus = 'active' | 'closed';
export type ItTicketTone = 'success' | 'teal' | 'neutral';

export const PRIORITY_LABEL: Record<ItTicketPriority, string> = {
  important: 'Important',
  medium: 'Medium',
  low: 'Low',
};

// Figma chip tokens: Important = t10 (red), Medium = t7 (amber), Low = t9 (green).
export const PRIORITY_TONE: Record<ItTicketPriority, { bg: string; fg: string }> = {
  important: { bg: 'var(--status-t10-bg)', fg: 'var(--status-t10-fg)' },
  medium: { bg: 'var(--status-t7-bg)', fg: 'var(--status-t7-fg)' },
  low: { bg: 'var(--status-t9-bg)', fg: 'var(--status-t9-fg)' },
};

export const CATEGORY_TONE: Record<ItTicketTone, { bg: string; fg: string }> = {
  success: { bg: 'var(--status-t9-bg)', fg: 'var(--status-t9-fg)' },
  teal: { bg: 'var(--status-t5-bg)', fg: 'var(--status-t5-fg)' },
  neutral: { bg: 'var(--status-t0-bg)', fg: 'var(--status-t0-fg)' },
};

export const CATEGORY_ICON: Record<ItTicketTone, LucideIcon | null> = {
  success: Mail,
  teal: RotateCcw,
  neutral: null,
};

/**
 * Toolbar dropdown (Newest / Priority) on the shared `Select` from components/ui — same look as the
 * HR Requests toolbar, so the open list is the platform dropdown, not the browser's native one.
 */
export const TOOLBAR_SELECT =
  'inline-flex h-10 w-auto cursor-pointer items-center gap-2 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pr-3 text-[13px] font-medium text-[var(--color-secondary-700)] dark:rounded-[6px] dark:border-[var(--ui-input-border)] dark:bg-ui-input-bg dark:pr-3 dark:text-ui-heading [&_svg]:size-3.5';

/** Arrow icon placed inside a sort `Select`, left of its value. */
export const TOOLBAR_SORT_ICON =
  'pointer-events-none absolute left-3 top-1/2 z-[1] size-3.5 -translate-y-1/2 text-[var(--color-secondary-700)] dark:text-ui-heading';

/** Shown on every action that needs an IT tickets endpoint that does not exist yet. */
export const NOT_CONNECTED_TITLE = 'Not available yet: the IT tickets data source is not connected';

export function formatTicketDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
}
