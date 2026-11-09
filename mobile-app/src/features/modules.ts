import type { Href } from 'expo-router';
import type { IconName } from '@/ui/Icon';
import type { Tone } from '@/ui/theme';
import type { Me } from '@/lib/auth';

// Every mobile module, grouped like the mobile-design boards. `show` mirrors the gate of the API the
// screen reads (web page permission or the API's role list) — hiding is convenience; the API decides.
export interface Module { label: string; icon: IconName; tone: Tone; href: Href; show: (me: Me) => boolean }

const page = (key: string) => (me: Me) => me.pages.includes(key);
const roles = (...r: string[]) => (me: Me) => r.includes(me.role);
const everyone = () => true;
const any = (...fs: ((me: Me) => boolean)[]) => (me: Me) => fs.some(f => f(me));

const WAREHOUSE = roles('warehouse_manager', 'warehouse_user', 'logistics', 'trustlines_pm', 'ops_manager', 'general_manager');
const DELIVERY = roles('ops_manager', 'general_manager', 'trustlines_pm', 'tlines_pm', 'logistics', 'qc_responsible', 'pm_millwork', 'pm_ceiling');
const SALES = roles('sales_rep', 'sales_marketing_manager', 'ops_manager', 'general_manager');
const SURVEYS = roles('marketing_pr', 'marketing_manager', 'general_manager', 'ops_manager');

export const MODULE_GROUPS: { title: string; items: Module[] }[] = [
  { title: 'Operasyon', items: [
    { label: 'Kalite Kontrol', icon: 'clip', tone: 'g', href: '/qc', show: page('page.qc') },
    { label: 'Konteynerler', icon: 'box', tone: 'i', href: '/containers', show: page('page.logistics') },
    { label: 'Depo', icon: 'warehouse', tone: 'a', href: '/warehouse', show: WAREHOUSE },
    { label: 'Sevkiyat takvimi', icon: 'truck', tone: 'o', href: '/calendar', show: DELIVERY },
  ] },
  { title: 'Proje & saha', items: [
    { label: 'Projeler', icon: 'folder', tone: 'i', href: '/projects', show: page('page.projects') },
    { label: 'Kurulumlar', icon: 'cal', tone: 'i', href: '/installations', show: page('page.installation') },
  ] },
  { title: 'İnsan kaynakları', items: [
    { label: 'İzin & taleplerim', icon: 'cal', tone: 'g', href: '/hr/requests', show: everyone },
    { label: 'Vardiya planı', icon: 'clock', tone: 'i', href: '/hr/shifts', show: everyone },
    { label: 'Ekibim', icon: 'users', tone: 'i', href: '/hr/team', show: everyone },
    { label: 'Ekip talepleri', icon: 'pen', tone: 'a', href: '/hr/approvals', show: everyone },
    { label: 'Ekip rehberi', icon: 'user', tone: 'i', href: '/team', show: page('page.team') },
  ] },
  { title: 'Finans & onay', items: [
    { label: 'Onaylar', icon: 'pen', tone: 'a', href: '/approvals', show: page('page.approvals') },
    { label: 'Masraflar', icon: 'receipt', tone: 'a', href: '/expenses', show: any(page('page.expenses'), roles('accounting', 'accountant')) },
    { label: 'Tedarikçiler', icon: 'truck', tone: 'i', href: '/suppliers', show: page('page.suppliers') },
  ] },
  { title: 'Satış & pazarlama', items: [
    { label: 'Müşteriler', icon: 'building', tone: 'i', href: '/customers', show: page('page.customers') },
    { label: 'Satış fırsatları', icon: 'spark', tone: 'o', href: '/sales', show: SALES },
    { label: 'Anket QR', icon: 'qr', tone: 'o', href: '/surveys', show: SURVEYS },
  ] },
  { title: 'Araçlar', items: [
    { label: 'Ara', icon: 'search', tone: 'i', href: '/search', show: everyone },
    { label: 'Bildirimler', icon: 'bell', tone: 'i', href: '/notifications', show: everyone },
    { label: 'AI asistan', icon: 'spark', tone: 'o', href: '/assistant', show: everyone },
  ] },
];

/** Home shortcuts in priority order; the first eight the role may open are shown. */
export const QUICK_ORDER = ['QR Tara', 'Kalite Kontrol', 'Depo', 'Projeler', 'Konteynerler', 'Onaylar', 'Ekibim', 'Masraflar', 'Sevkiyat takvimi', 'Müşteriler'];
export const SHORT: Record<string, string> = { 'Kalite Kontrol': 'QC', Konteynerler: 'Konteyner', 'Sevkiyat takvimi': 'Takvim', Masraflar: 'Masraf' };
