import { CalendarDays, Columns3, Rows3, type LucideIcon } from 'lucide-react';

export type ViewMode = 'list' | 'board' | 'calendar';
export interface Assignee { id: string; full_name: string }

// Figma "CRM Board" (node 280:25017).
// 36px filter control: input border, white field, 13px medium label.
export const FILTER_CLS = 'inline-flex h-9 w-auto shrink-0 cursor-pointer items-center gap-1 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-3 pr-2 text-[13px] font-medium leading-normal text-[var(--color-secondary-700)] dark:rounded-[6px] dark:text-ui-heading [&_svg]:size-3.5';

export const VIEW_TABS: { key: ViewMode; label: string; icon: LucideIcon }[] = [
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'board', label: 'Board', icon: Columns3 },
  { key: 'list', label: 'List', icon: Rows3 },
];

export const PRIORITY_OPTIONS = [
  { value: '', label: 'Priority' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export const SORT_OPTIONS = [
  { value: 'created_desc', label: 'Newest' },
  { value: 'created_asc', label: 'Oldest' },
  { value: 'deal_desc', label: 'Deal size' },
  { value: 'priority', label: 'Priority' },
];

/** KPI "+N New" chip window. */
export const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Assignee filter value for rows with no owner. */
export const UNASSIGNED = '__none__';
