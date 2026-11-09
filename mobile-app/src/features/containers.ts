// GET /api/containers, /api/containers/[id], /api/containers/[id]/documents (logistics module).
import type { IconName } from '@/ui/Icon';
import type { Tone } from '@/ui/theme';

export interface Container {
  id: string; container_no: string | null; booking_no: string | null; carrier: string | null;
  vessel_name: string | null; voyage_no: string | null; origin_port: string | null; destination_port: string | null;
  departure_date: string | null; estimated_arrival_date: string | null; actual_arrival_date: string | null;
  customs_clearance_date: string | null; warehouse_arrival_date: string | null;
  status: string; seal_no: string | null; tracking_url: string | null; notes: string | null; item_count?: number;
}
export interface ContainerItem {
  id: string; quantity: number | null; package_count: number | null; loaded_at: string | null; unloaded_at: string | null;
  production_item: { type: string; project_code: string | null } | null;
}
export interface ContainerDoc { id: string; doc_type: string; name: string; url: string | null; created_at: string }

// lib/logistics/containers.ts CONTAINER_STATUSES, in order.
export const STATUS_ORDER = ['PLANNING', 'BOOKED', 'WAITING_LOADING', 'LOADING', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED_PORT', 'CUSTOMS', 'RELEASED', 'WAREHOUSE', 'COMPLETED'] as const;
export const STATUS_TR: Record<string, string> = {
  PLANNING: 'Planlama', BOOKED: 'Booking onaylı', WAITING_LOADING: 'Yükleme bekliyor', LOADING: 'Yükleniyor',
  DEPARTED: 'Yola çıktı', IN_TRANSIT: 'Yolda', ARRIVED_PORT: 'Limanda', CUSTOMS: 'Gümrükte', RELEASED: 'Gümrükten çıktı',
  WAREHOUSE: 'Depoda', COMPLETED: 'Tamamlandı', CANCELLED: 'İptal',
};

export type ContainerGroup = 'loading' | 'transit' | 'arrived' | 'all';
export function groupOf(status: string): ContainerGroup {
  if (['PLANNING', 'BOOKED', 'WAITING_LOADING', 'LOADING'].includes(status)) return 'loading';
  if (['DEPARTED', 'IN_TRANSIT', 'CUSTOMS', 'RELEASED'].includes(status)) return 'transit';
  return 'arrived';
}
export function statusUi(status: string): { tone: Tone; icon: IconName } {
  const g = groupOf(status);
  return g === 'loading' ? { tone: status === 'LOADING' ? 'o' : 'i', icon: 'box' } : g === 'transit' ? { tone: 'g', icon: 'anchor' } : { tone: 'g', icon: 'warehouse' };
}
/** Rough voyage progress from departure → ETA (the mockup's progress bar). */
export function voyagePct(c: Container, now = Date.now()) {
  const a = c.departure_date ? Date.parse(c.departure_date) : NaN;
  const z = c.estimated_arrival_date ? Date.parse(c.estimated_arrival_date) : NaN;
  if (!Number.isFinite(a) || !Number.isFinite(z) || z <= a) return null;
  return Math.round(Math.max(0, Math.min(1, (now - a) / (z - a))) * 100);
}
export const DOC_TR: Record<string, string> = { bill_of_lading: 'BL', packing_list: 'Packing list', customs: 'Gümrük', invoice: 'Invoice', other: 'Belge' };
