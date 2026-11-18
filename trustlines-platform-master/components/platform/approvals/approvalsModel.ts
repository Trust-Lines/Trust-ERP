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
  // In sample or real data, show non-completed or open items
  if (tab === 'open') return rows.filter(r => r.status !== 'Completed');
  if (tab === 'assigned') return rows.filter(r => r.ownerInitials === 'MC' || r.isRealApproval);
  return rows.filter(r => r.priority === 'High' || r.isRealApproval);
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

// Sample fallback items matching the reference specification exactly
export const SAMPLE_REQUESTS: UnifiedRequestRow[] = [
  {
    id: 'req-1048',
    isRealApproval: false,
    title: 'Workspace access — new hires',
    code: 'REQ-1048',
    ownerName: 'Maya Chen',
    ownerInitials: 'MC',
    status: 'Design',
    priority: 'High',
    amount: 2400.0,
    updatedLabel: 'Today, 09:42',
    rawDate: Date.now() - 1000 * 60 * 35,
  },
  {
    id: 'req-1047',
    isRealApproval: false,
    title: 'Figma Enterprise renewal',
    code: 'REQ-1047',
    ownerName: 'Alex Morgan',
    ownerInitials: 'AM',
    status: 'Planning',
    priority: 'Medium',
    amount: 18000.0,
    updatedLabel: 'Today, 09:28',
    rawDate: Date.now() - 1000 * 60 * 50,
  },
  {
    id: 'req-1046',
    isRealApproval: false,
    title: 'London office equipment',
    code: 'REQ-1046',
    ownerName: 'Priya Shah',
    ownerInitials: 'PS',
    status: 'Production',
    priority: 'High',
    amount: 6850.0,
    updatedLabel: 'Today, 08:56',
    rawDate: Date.now() - 1000 * 60 * 85,
  },
  {
    id: 'req-1045',
    isRealApproval: false,
    title: 'Q4 customer research incentives',
    code: 'REQ-1045',
    ownerName: 'Noah Williams',
    ownerInitials: 'NW',
    status: 'Quality Control',
    priority: 'Medium',
    amount: 3200.0,
    updatedLabel: 'Yesterday, 16:30',
    rawDate: Date.now() - 1000 * 60 * 60 * 20,
  },
  {
    id: 'req-1044',
    isRealApproval: false,
    title: 'Security audit — vendor review',
    code: 'REQ-1044',
    ownerName: 'Maya Chen',
    ownerInitials: 'MC',
    status: 'Planning',
    priority: 'High',
    amount: 12500.0,
    updatedLabel: 'Yesterday, 15:12',
    rawDate: Date.now() - 1000 * 60 * 60 * 22,
  },
  {
    id: 'req-1043',
    isRealApproval: false,
    title: 'Offsite travel arrangements',
    code: 'REQ-1043',
    ownerName: 'Sofia Garcia',
    ownerInitials: 'SG',
    status: 'Installation',
    priority: 'Low',
    amount: 8640.0,
    updatedLabel: 'Yesterday, 14:05',
    rawDate: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: 'req-1042',
    isRealApproval: false,
    title: 'Analytics platform upgrade',
    code: 'REQ-1042',
    ownerName: 'Alex Morgan',
    ownerInitials: 'AM',
    status: 'Completed',
    priority: 'Medium',
    amount: 4800.0,
    updatedLabel: 'Oct 14, 11:20',
    rawDate: Date.now() - 1000 * 60 * 60 * 48,
  },
  {
    id: 'req-1041',
    isRealApproval: false,
    title: 'Brand asset localization',
    code: 'REQ-1041',
    ownerName: 'Priya Shah',
    ownerInitials: 'PS',
    status: 'Completed',
    priority: 'Low',
    amount: 1950.0,
    updatedLabel: 'Oct 14, 10:08',
    rawDate: Date.now() - 1000 * 60 * 60 * 50,
  },
];

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
