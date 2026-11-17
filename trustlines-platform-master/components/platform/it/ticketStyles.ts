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
