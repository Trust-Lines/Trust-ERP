import type { SiteReadinessItem } from '@/types/database';

export const FINALIZATION_READ_ROLES = [
  'ops_manager', 'general_manager', 'trustlines_pm', 'tlines_pm', 'pm_millwork', 'pm_ceiling',
];
export const FINALIZATION_WRITE_ROLES = [
  'ops_manager', 'general_manager', 'trustlines_pm', 'tlines_pm',
];

export const CHANGE_REQUEST_STATUSES = [
  'open', 'under_review', 'approved', 'rejected', 'implemented', 'cancelled',
] as const;
export const CHANGE_REQUEST_CATEGORIES = ['scope', 'design', 'budget', 'timeline', 'material', 'other'];

export const DEFAULT_SITE_ITEMS: { key: string; label: string }[] = [
  { key: 'site_access',   label: 'Site access confirmed' },
  { key: 'electricity',   label: 'Electrical work complete' },
  { key: 'walls',         label: 'Walls ready' },
  { key: 'ceiling',       label: 'Ceiling ready' },
  { key: 'flooring',      label: 'Flooring ready' },
  { key: 'measurements',  label: 'Final measurements verified on site' },
  { key: 'permits',       label: 'Permits / approvals in place' },
  { key: 'storage',       label: 'On-site storage / staging available' },
];

export function defaultSiteChecklist(): SiteReadinessItem[] {
  return DEFAULT_SITE_ITEMS.map(i => ({ key: i.key, label: i.label, done: false, done_at: null, done_by: null }));
}

export function deriveOverallStatus(items: SiteReadinessItem[]): 'not_ready' | 'partial' | 'ready' {
  if (items.length === 0) return 'not_ready';
  const done = items.filter(i => i.done).length;
  if (done === 0) return 'not_ready';
  if (done === items.length) return 'ready';
  return 'partial';
}
