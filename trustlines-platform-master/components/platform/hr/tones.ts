import type { HrEventKind } from './types';

// Figma "Status Colors" tones per calendar kind (globals.css --status-tN-*): -bg is the pale
// fill, -fg the strong colour (Figma labels T2 the other way round; values follow the design).
export const KIND_TONE: Record<HrEventKind, { bg: string; fg: string }> = {
  delivery: { bg: 'var(--status-t2-bg)', fg: 'var(--status-t2-fg)' },
  reminder: { bg: 'var(--status-t6-bg)', fg: 'var(--status-t6-fg)' },
  container: { bg: 'var(--status-t8-bg)', fg: 'var(--status-t8-fg)' },
  birthday: { bg: 'var(--status-t4-bg)', fg: 'var(--status-t4-fg)' },
  absent: { bg: 'var(--status-t0-bg)', fg: 'var(--status-t0-fg)' },
  holiday: { bg: 'var(--status-t10-bg)', fg: 'var(--status-t10-fg)' },
};

export const KIND_LABEL: Record<HrEventKind, string> = {
  delivery: 'Order Delivery',
  reminder: 'Reminder',
  container: 'Container',
  birthday: 'Birthday',
  absent: 'Absent',
  holiday: 'Public Holiday',
};

export const KIND_ORDER: HrEventKind[] = ['delivery', 'reminder', 'container', 'birthday', 'absent', 'holiday'];

/** YYYY-MM-DD → local Date (no UTC shift). */
export function parseDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole days from today to `iso` (0 = today, negative = past). */
export function daysUntil(iso: string, today: Date): number {
  return Math.round((parseDay(iso).getTime() - startOfDay(today).getTime()) / 86_400_000);
}

export function daysLeftLabel(n: number): string {
  if (n < 0) return `${-n} day${n === -1 ? '' : 's'} ago`;
  if (n === 0) return 'Today';
  return `${n} day${n === 1 ? '' : 's'} left`;
}
