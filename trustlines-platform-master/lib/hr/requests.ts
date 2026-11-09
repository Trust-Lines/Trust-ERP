import type { TimePunchKind } from '@/types/database';

// HR requests (migration 145): who may decide, and what a valid request looks like.

export const HR_ADMIN_ROLES = ['ops_manager', 'general_manager'];
export const LEAVE_REASONS = ['vacation', 'sick', 'personal'] as const;
const PUNCH_KINDS: TimePunchKind[] = ['in', 'break_start', 'break_end', 'out'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MS_DAY = 864e5;

/** Approve / reject / plan shifts for someone: their manager, or ops / GM — never for yourself. */
export function canManage(actor: { id: string; role: string | null }, target: { id: string; manager_id: string | null }): boolean {
  if (actor.id === target.id) return false;
  return HR_ADMIN_ROLES.includes(actor.role ?? '') || target.manager_id === actor.id;
}

/** Calendar days in an inclusive YYYY-MM-DD range. */
export const leaveDays = (start: string, end: string) =>
  Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / MS_DAY) + 1;

export type NewRequest =
  | { kind: 'leave'; reason: (typeof LEAVE_REASONS)[number]; start_date: string; end_date: string; priority: string; description: string | null }
  | { kind: 'correction'; correction_kind: TimePunchKind; correction_at: string; priority: string; description: string | null };

export function validateRequest(b: Record<string, unknown>, now = Date.now()): { value: NewRequest } | { error: string } {
  const priority = ['important', 'medium', 'low'].includes(String(b.priority)) ? String(b.priority) : 'medium';
  const description = typeof b.description === 'string' ? b.description.trim().slice(0, 1000) || null : null;

  if (b.kind === 'leave') {
    const reason = String(b.reason) as (typeof LEAVE_REASONS)[number];
    const start = String(b.start_date ?? ''), end = String(b.end_date ?? '');
    if (!LEAVE_REASONS.includes(reason)) return { error: 'reason must be vacation, sick or personal' };
    if (!DAY.test(start) || !DAY.test(end) || Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end))) return { error: 'Dates must be YYYY-MM-DD' };
    if (end < start) return { error: 'The end date is before the start date' };
    if (leaveDays(start, end) > 90) return { error: 'A request can cover at most 90 days' };
    return { value: { kind: 'leave', reason, start_date: start, end_date: end, priority, description } };
  }
  if (b.kind === 'correction') {
    const kind = String(b.correction_kind) as TimePunchKind;
    const at = Date.parse(String(b.correction_at ?? ''));
    if (!PUNCH_KINDS.includes(kind)) return { error: 'correction_kind must be in, break_start, break_end or out' };
    if (!Number.isFinite(at)) return { error: 'correction_at must be a date-time' };
    if (at > now) return { error: 'A correction cannot be in the future' };
    if (at < now - 31 * MS_DAY) return { error: 'Corrections are limited to the last 31 days' };
    if (!description) return { error: 'Explain the correction' };
    return { value: { kind: 'correction', correction_kind: kind, correction_at: new Date(at).toISOString(), priority, description } };
  }
  return { error: "kind must be 'leave' or 'correction'" };
}

/** Postgres "table does not exist" (migration not applied) as seen through PostgREST. */
export function tableMissing(e: { code?: string; message?: string } | null | undefined, table: string) {
  return !!e && (e.code === '42P01' || e.code === 'PGRST205' || (e.message ?? '').includes(table));
}
