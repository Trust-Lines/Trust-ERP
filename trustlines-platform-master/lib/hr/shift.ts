import type { TimePunchKind } from '@/types/database';

export type ShiftStatus = 'off' | 'on' | 'break';

/** Which punch may follow the person's latest one. Anything else is a double tap or out of order. */
export const NEXT_KINDS: Record<ShiftStatus, TimePunchKind[]> = {
  off: ['in'],
  on: ['break_start', 'out'],
  break: ['break_end'],
};

export function statusAfter(last: TimePunchKind | null | undefined): ShiftStatus {
  if (last === 'in' || last === 'break_end') return 'on';
  if (last === 'break_start') return 'break';
  return 'off';
}

export function punchAllowed(last: TimePunchKind | null | undefined, next: TimePunchKind): boolean {
  return NEXT_KINDS[statusAfter(last)].includes(next);
}
