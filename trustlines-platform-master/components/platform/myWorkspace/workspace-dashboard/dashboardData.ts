import type { MyTaskStatus } from '@/lib/myWorkspace/taskTypes';

export interface DashProject {
  id: string; code: string; name: string; region: string | null; current_stage: string;
  categories: string[] | null; site_location: string | null; created_at: string;
  closed_deal_date: string | null; est_production_start: string | null;
}
export interface DesignDoc { id: string; project_id: string; file_name: string; file_size_bytes: number | null; created_at: string }
export interface Container { id: string; container_no: string | null; estimated_arrival_date: string | null; status: string; item_count: number }
export type Loaded<T> = T[] | 'denied' | 'error' | null;
export type ListState = 'loading' | 'error' | 'empty' | 'ready';
export interface MonthBucket { key: string; mon: string; year: number }
export interface DashboardAccess { projects: boolean; production: boolean; installation: boolean; logistics: boolean; opportunities: boolean }

export const REGIONS = [
  { key: 'NE', code: 'TLINES_NE', label: 'T-Lines North East', color: '#465B6D' },
  { key: 'SE', code: 'TLINES_SE', label: 'T-Lines South East', color: '#3B472B' },
  { key: 'NW', code: 'TLINES_NW', label: 'T-Lines North West', color: '#2E5BA3' },
  { key: 'CVW', code: 'CVW', label: 'CVW T-Lines', color: '#7A655E' },
] as const;
export type RegionKey = (typeof REGIONS)[number]['key'];
export const regionOf = (code: string | null) => REGIONS.find(r => r.code === code || r.key === code)?.key ?? null;

export const CARD = 'rounded-[16px] border border-ui-divider bg-ui-surface-elevated';
export const MON = new Intl.DateTimeFormat('en-GB', { month: 'short' });
export const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
export const STATUS_LABEL: Record<MyTaskStatus, string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
export const STATUS_TONE: Record<MyTaskStatus, string> = { todo: 't2', in_progress: 't7', done: 't9' };
export const DAY_MS = 86400000;

// ── dates ──────────────────────────────────────────────────────────────────────────────────────
export const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const parseDay = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
export const fmtDay = (d: Date) => `${d.getDate()} ${MON.format(d)} ${d.getFullYear()}`;
export const PRESETS = [
  { value: 'week', label: 'This week' }, { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' }, { value: 'year', label: 'This year' },
];
export function presetRange(p: string, now = new Date()): [Date, Date] {
  const t = dayStart(now);
  if (p === 'week') { const s = new Date(t); s.setDate(t.getDate() - ((t.getDay() + 6) % 7)); const e = new Date(s); e.setDate(s.getDate() + 6); return [s, e]; }
  if (p === 'month') return [new Date(t.getFullYear(), t.getMonth(), 1), new Date(t.getFullYear(), t.getMonth() + 1, 0)];
  if (p === 'quarter') { const q = Math.floor(t.getMonth() / 3) * 3; return [new Date(t.getFullYear(), q, 1), new Date(t.getFullYear(), q + 3, 0)]; }
  return [new Date(t.getFullYear(), 0, 1), new Date(t.getFullYear(), 11, 31)];
}
/** Month buckets covering [from, to] (at least one). */
export function monthsBetween(from: Date, to: Date) {
  const out: MonthBucket[] = [];
  const d = new Date(from.getFullYear(), from.getMonth(), 1);
  while (d <= to && out.length < 36) {
    out.push({ key: `${d.getFullYear()}-${d.getMonth()}`, mon: MON.format(d).toUpperCase(), year: d.getFullYear() });
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}
export const monthKey = (s: string) => { const d = parseDay(s); return `${d.getFullYear()}-${d.getMonth()}`; };
export const inRange = (s: string | null, from: Date, to: Date) => { if (!s) return false; const d = parseDay(s); return d >= from && d <= to; };
export const startOf = (p: DashProject) => p.est_production_start ?? p.created_at;
export const fileSize = (b: number | null) => (b == null ? '' : b >= 1048576 ? `${(b / 1048576).toFixed(b >= 10485760 ? 0 : 1)} mb` : `${Math.max(1, Math.round(b / 1024))} kb`);

export async function getList<T>(url: string, pick: (b: Record<string, unknown>) => T[]): Promise<Loaded<T>> {
  const res = await fetch(url).catch(() => null);
  if (res && (res.status === 401 || res.status === 403)) return 'denied';
  if (!res?.ok) return 'error';
  const body = await res.json().catch(() => null);
  return body ? pick(body) : 'error';
}

export const listState = <T,>(d: Loaded<T> | T[] | null, n: number): ListState =>
  (d === null ? 'loading' : d === 'error' ? 'error' : n === 0 ? 'empty' : 'ready');
