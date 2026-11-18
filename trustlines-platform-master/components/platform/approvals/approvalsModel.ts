import { ListFilter, UserRound, CircleCheck } from 'lucide-react';
import type { ComponentType } from 'react';
import type { MyApproval } from '@/lib/approvals/mine';

// Approvals list model: row shape, saved views, filters, density and the pure helpers that map
// real approvals onto list rows. No React state here.

export type TabKey = 'open' | 'assigned' | 'needs_approval';
export type PriorityLevel = 'High' | 'Medium' | 'Low';
export type StatusType = 'Design' | 'Planning' | 'Production' | 'Quality Control' | 'Installation' | 'Completed';
export type Density = 'compact' | 'normal' | 'comfortable';

export interface UnifiedRequestRow {
  id: string;
  isRealApproval: boolean;
  approvalData?: MyApproval;
  title: string;
  code: string;
  ownerName: string;
  ownerInitials: string;
  status: StatusType;
  priority: PriorityLevel;
  amount: number;
  updatedLabel: string;
  rawDate: number;
}

export type RowOverride = Partial<Pick<UnifiedRequestRow, 'title' | 'status' | 'ownerName' | 'ownerInitials'>>;

// Saved views = the three tabs. Each keeps its own row rule (rowsForTab).
export const SAVED_VIEWS: { key: TabKey; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: 'open',           label: 'Open requests',  icon: ListFilter },
  { key: 'assigned',       label: 'Assigned to me', icon: UserRound },
  { key: 'needs_approval', label: 'Needs approval', icon: CircleCheck },
];

export function rowsForTab(rows: UnifiedRequestRow[], tab: TabKey): UnifiedRequestRow[] {
  // Every row is an approval waiting on the viewer, so 'assigned' and 'needs_approval' show them all.
  if (tab === 'open') return rows.filter(r => r.status !== 'Completed');
  return rows.filter(r => r.isRealApproval);
}

export type FilterField = 'priority' | 'status' | 'owner';
export interface FilterCondition { field: FilterField; values: string[] }

export const FILTER_FIELD_LABEL: Record<FilterField, string> = { priority: 'Priority', status: 'Status', owner: 'Owner' };
export const FILTER_FIELD_VALUE: Record<FilterField, (r: UnifiedRequestRow) => string> = {
  priority: r => r.priority,
  status:   r => r.status,
  owner:    r => r.ownerName,
};

export const DENSITY_ROW_HEIGHT: Record<Density, { px: number; className: string }> = {
  compact:     { px: 36, className: 'h-9' },
  normal:      { px: 64, className: 'h-16' },
  comfortable: { px: 72, className: 'h-[72px]' },
};

// "request" is locked on in the Columns menu.
export const DEFAULT_VISIBLE_COLUMNS = {
  request: true,
  owner: true,
  status: true,
  priority: true,
  amount: true,
  updated: true,
};

export const STATUS_OPTIONS: StatusType[] = ['Planning', 'Design', 'Production', 'Quality Control', 'Installation', 'Completed'];

export function mapDocTypeToStatus(docType: string): StatusType {
  switch (docType) {
    case 'plan_layout':
    case 'proposal':
      return 'Design';
    case 'construction_drawings':
    case 'shop_drawing':
      return 'Planning';
    case 'po_bo':
    case 'pf':
      return 'Production';
    case 'book':
    case 'qc':
      return 'Quality Control';
    case 'item_plan':
    case 'item_list':
      return 'Installation';
    default:
      return 'Planning';
  }
}

export function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Recently';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (isToday) return `Today, ${timeStr}`;
  if (isYesterday) return `Yesterday, ${timeStr}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${timeStr}`;
}
