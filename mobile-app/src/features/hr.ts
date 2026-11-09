// /api/hr/requests, /api/hr/shifts, /api/hr/team (migration 145).
import type { Tone } from '@/ui/theme';
import type { PunchKind, ShiftStatus } from '@/lib/shift';

export interface HrRequest {
  id: string; user_id: string; kind: 'leave' | 'correction';
  reason: 'vacation' | 'sick' | 'personal' | null; start_date: string | null; end_date: string | null;
  correction_kind: PunchKind | null; correction_at: string | null;
  priority: string; description: string | null; status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  decision_note: string | null; decided_at: string | null; created_at: string;
}
export interface HrShift { id: string; user_id: string; shift_date: string; start_time: string; end_time: string; site: string | null; note: string | null }
export interface TeamPerson { id: string; full_name: string; role: string | null; status: ShiftStatus; since: string | null; site: string | null; pending: number }

export const REASON_TR: Record<string, string> = { vacation: 'Yıllık izin', sick: 'Hastalık', personal: 'Mazeret' };
export const PUNCH_TR: Record<PunchKind, string> = { in: 'Giriş', break_start: 'Mola başlangıcı', break_end: 'Mola bitişi', out: 'Çıkış' };
export const REQ_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Bekliyor', tone: 'a' }, approved: { label: 'Onaylandı', tone: 'g' },
  rejected: { label: 'Reddedildi', tone: 'r' }, cancelled: { label: 'İptal', tone: 'n' },
};
export const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5) + 1;
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
