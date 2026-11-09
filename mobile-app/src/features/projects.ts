// /api/mobile/projects (+ /[id]) and the per-project APIs under /api/projects/[id]/*.
import type { Tone } from '@/ui/theme';

export interface ProjectRow {
  id: string; code: string | null; name: string; current_stage: string | null; categories: string[] | null;
  est_delivery_date: string | null; site_location: string | null; region: string | null;
}
export interface ProjectDetail extends ProjectRow { closed_deal_date: string | null; created_at: string }
export interface ItemRow {
  id: string; type: string | null; order_type: string | null; status: string | null;
  std: string | null; etd: string | null; rdy: string | null; snd: string | null; container_no: string | null;
}
export interface PunchItem { id: string; title: string; description: string | null; status: 'open' | 'done'; resolved_at: string | null; created_at: string }
export interface ChangeRequest { id: string; title: string; description: string | null; category: string | null; status: string; timeline_impact_days: number | null; decision_note: string | null; created_at: string }
export interface DeliveryPlan { delivery_method: string | null; installation_date: string | null; build_by: string | null; site_confirmed: boolean | null; customer_accepted: boolean | null; status: string | null; notes: string | null }
export interface ProjectDoc { id: string; doc_type: string; version: number | null; status: string | null; file_name: string | null; uploaded_at: string | null; uploader?: { full_name: string } | null }

/** Production item status (lib/production/board STATUS_CHAIN) → Turkish label + tone. */
export const ITEM_STATUS: Record<string, { label: string; tone: Tone }> = {
  NOT_ORDERED: { label: 'Sipariş yok', tone: 'n' }, ORDERED: { label: 'Sipariş verildi', tone: 'i' },
  WAITING_PAYMENT: { label: 'Ödeme bekliyor', tone: 'a' }, READY_TO_RECEIVE: { label: 'Teslime hazır', tone: 'i' },
  RECEIVED: { label: 'Teslim alındı', tone: 'g' }, READY: { label: 'Hazır', tone: 'g' }, SENT_TO_TLINES: { label: 'T-Lines\'a gönderildi', tone: 'g' },
  PARTIAL_SENT: { label: 'Kısmi gönderildi', tone: 'o' }, SENT: { label: 'Gönderildi', tone: 'g' },
  HOLD_T: { label: 'Bekletiliyor', tone: 'a' }, HOLD_PM: { label: 'PM bekletiyor', tone: 'a' }, ASSEMBLY: { label: 'Montaj', tone: 'i' },
};
export const itemStatus = (s: string | null) => (s && ITEM_STATUS[s]) || { label: s ?? '—', tone: 'n' as Tone };

export const CR_STATUS: Record<string, { label: string; tone: Tone }> = {
  open: { label: 'Açık', tone: 'a' }, pending: { label: 'Bekliyor', tone: 'a' }, approved: { label: 'Onaylandı', tone: 'g' },
  rejected: { label: 'Reddedildi', tone: 'r' }, implemented: { label: 'Uygulandı', tone: 'g' }, cancelled: { label: 'İptal', tone: 'n' },
};
export const DELIVERY_METHOD_TR: Record<string, string> = { warehouse: 'Depo üzerinden', direct_job_site: 'Doğrudan sahaya', partial: 'Kısmi', hold: 'Beklemede' };
export const DELIVERY_STATUS_TR: Record<string, string> = { planning: 'Planlanıyor', scheduled: 'Planlandı', in_progress: 'Devam ediyor', completed: 'Tamamlandı' };
export const stageLabel = (s: string | null) => (s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—');
