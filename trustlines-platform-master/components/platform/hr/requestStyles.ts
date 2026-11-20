import { Clock, Pill, TreePalm, UserRound, type LucideIcon } from 'lucide-react';
import type { HrPunchKind, HrRequest, HrRequestPriority, HrRequestReason, HrRequestStatus } from './types';
import { daysUntil, parseDay } from './tones';

// Shared look of HR leave requests (Figma "Requests" 565:15743 and its detail 565:17594).

export const PRIORITY: Record<HrRequestPriority, { label: string; bg: string; fg: string }> = {
  important: { label: 'Important', bg: 'var(--status-t10-bg)', fg: 'var(--status-t10-fg)' },
  medium: { label: 'Medium', bg: 'var(--status-t7-bg)', fg: 'var(--status-t7-fg)' },
  low: { label: 'Low', bg: 'var(--status-t9-bg)', fg: 'var(--status-t9-fg)' },
};
export const PRIORITY_RANK: Record<HrRequestPriority, number> = { important: 0, medium: 1, low: 2 };

export const REASON: Record<HrRequestReason, { label: string; icon: LucideIcon; bg: string; fg: string }> = {
  sick: { label: 'Call in Sick', icon: Pill, bg: 'var(--status-t9-bg)', fg: 'var(--status-t9-fg)' },
  vacation: { label: 'Vacation Request', icon: TreePalm, bg: 'var(--status-t5-bg)', fg: 'var(--status-t5-fg)' },
  personal: { label: 'Personal Leave', icon: UserRound, bg: 'var(--status-t7-bg)', fg: 'var(--status-t7-fg)' },
  correction: { label: 'Clock Correction', icon: Clock, bg: 'var(--status-t0-bg)', fg: 'var(--status-t0-fg)' },
};

export const PUNCH_LABEL: Record<HrPunchKind, string> = {
  in: 'Clock in', break_start: 'Break start', break_end: 'Break end', out: 'Clock out',
};

export const STATUS: Record<Exclude<HrRequestStatus, 'pending'> | 'cancelled', { label: string; bg: string; fg: string }> = {
  approved: { label: 'Approved', bg: 'var(--status-t9-bg)', fg: 'var(--status-t9-fg)' },
  rejected: { label: 'Rejected', bg: 'var(--status-t10-bg)', fg: 'var(--status-t10-fg)' },
  cancelled: { label: 'Cancelled', bg: 'var(--status-t0-bg)', fg: 'var(--status-t0-fg)' },
};

/** "16 OCT 2026". */
export function longDay(iso: string) {
  const d = parseDay(iso);
  return `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()} ${d.getFullYear()}`;
}

/** "Mon 16/8/2026". */
export function shortDay(iso: string) {
  const d = parseDay(iso);
  return `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

/** Today / Tomorrow / Yesterday, else "16 OCT 2026". */
export function forLabel(iso: string, today: Date) {
  const n = daysUntil(iso, today);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return longDay(iso);
}

/** Days off, counting both ends. */
export function requestDays(r: Pick<HrRequest, 'date' | 'endDate'>) {
  return Math.max(1, Math.round((parseDay(r.endDate).getTime() - parseDay(r.date).getTime()) / 86_400_000) + 1);
}

export const initials = (name: string) =>
  name.split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
