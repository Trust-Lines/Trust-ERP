import type { IconName } from '@/ui/Icon';
import type { Tone } from '@/ui/theme';

// GET /api/my-day — trustlines-platform-master/lib/dashboard/myDay.ts (MyDayData).
export interface MyDayItem {
  label: string;
  sublabel?: string;
  href: string;
  badge?: string;
  tone?: 'default' | 'warn' | 'danger' | 'good';
}
export interface MyDaySection { key: string; title: string; items: MyDayItem[] }
export interface MyDay { role: string; sections: MyDaySection[] }

/** Turkish title + icon per my-day section key (the API's titles are the web's English ones). */
export const SECTION_UI: Record<string, { title: string; icon: IconName; tone: Tone }> = {
  signatures: { title: 'İmzanı bekleyenler', icon: 'pen', tone: 'a' },
  notifications: { title: 'Okunmamış bildirimler', icon: 'bell', tone: 'i' },
  assigned_to_me: { title: 'Bana atananlar', icon: 'user', tone: 'i' },
  qc_queue: { title: 'QC kuyruğu', icon: 'clip', tone: 'g' },
  overdue_followups: { title: 'Geciken takipler', icon: 'clock', tone: 'r' },
  site_not_ready: { title: 'Hazır olmayan sahalar', icon: 'alert', tone: 'r' },
  open_crs: { title: 'Açık değişiklik talepleri', icon: 'swap', tone: 'a' },
  vendor_needed: { title: 'Tedarikçi bekleyen tipler', icon: 'building', tone: 'a' },
  items_on_hold: { title: 'Bekletilen kalemler', icon: 'alert', tone: 'o' },
  open_containers: { title: 'Yoldaki konteynerler', icon: 'box', tone: 'i' },
  my_design_jobs: { title: 'Tasarım işlerim', icon: 'image', tone: 'i' },
  unpaid_invoices: { title: 'Ödenmemiş faturalar', icon: 'receipt', tone: 'a' },
  waiting_payment: { title: 'Ödeme bekleyenler', icon: 'receipt', tone: 'a' },
  prospects_assigned: { title: 'Atanan adaylar', icon: 'users', tone: 'i' },
  potentials_due: { title: 'Vadesi gelen potansiyeller', icon: 'clock', tone: 'a' },
  nurture_overdue: { title: 'Geciken takipler', icon: 'clock', tone: 'r' },
  handoffs_waiting: { title: 'Devir bekleyenler', icon: 'swap', tone: 'a' },
  default: { title: 'Diğer', icon: 'list', tone: 'i' },
};

export function toneOf(t?: string): Tone {
  return t === 'danger' ? 'r' : t === 'warn' ? 'o' : t === 'good' ? 'g' : 'i';
}
