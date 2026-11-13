'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ChevronDown,
  Download,
  Plus,
  Search,
  X,
  Rows3,
  LayoutGrid,
  ChevronRight,
  ChevronLeft,
  Archive,
  UserRound,
  CornerDownLeft,
  ListFilter,
  CircleCheck,
  Settings2,
  Eye,
  List,
  ChevronsUp,
  ChevronsDown,
  Equal,
  MoreHorizontal,
  Pencil,
  ArrowUpDown,
  ArrowDown,
  ArrowUp,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { ApprovalReviewDialog } from './ApprovalReviewDialog';
import { DOC_LABELS } from './docLabels';
import { StatusBadge } from '@/components/ui/status-badge';
import { Checkbox } from '@/components/ui/checkbox';
import { popupBase } from '@/components/ui/field-styles';
import { feedback } from '@/components/ui/feedback-toast';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { modalSecondaryButtonClass } from '@/components/ui/modal';
import { Select as FilterSelect } from '@/components/ui/select';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';


export interface MyApproval {
  approvalId:   string;
  projectId:    string;
  projectName:  string;
  projectCode:  string;
  documentId:   string;
  fileName:     string;
  docType:      string;
  catGroup:     string | null;
  version:      number;
  versionNum:   number | null;
  stage:        number;
  totalStages:  number;
  isFinalStage: boolean;
  stageLabel:   string;
  createdAt:    string;
}

const SignaturePad = dynamic(() => import('../SignaturePad').then(m => ({ default: m.SignaturePad })), { ssr: false });

type TabKey = 'open' | 'assigned' | 'needs_approval';
type PriorityLevel = 'High' | 'Medium' | 'Low';
type StatusType = 'Design' | 'Planning' | 'Production' | 'Quality Control' | 'Installation' | 'Completed';
type Density = 'compact' | 'normal' | 'comfortable';

interface UnifiedRequestRow {
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

type RowOverride = Partial<Pick<UnifiedRequestRow, 'title' | 'status' | 'ownerName' | 'ownerInitials'>>;

// Saved views = the three tabs. Each keeps its own row rule (rowsForTab).
const SAVED_VIEWS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'open',           label: 'Open requests',  icon: ListFilter },
  { key: 'assigned',       label: 'Assigned to me', icon: UserRound },
  { key: 'needs_approval', label: 'Needs approval', icon: CircleCheck },
];

function rowsForTab(rows: UnifiedRequestRow[], tab: TabKey): UnifiedRequestRow[] {
  // In sample or real data, show non-completed or open items
  if (tab === 'open') return rows.filter(r => r.status !== 'Completed');
  if (tab === 'assigned') return rows.filter(r => r.ownerInitials === 'MC' || r.isRealApproval);
  return rows.filter(r => r.priority === 'High' || r.isRealApproval);
}

type FilterField = 'priority' | 'status' | 'owner';
interface FilterCondition { field: FilterField; values: string[] }

const FILTER_FIELD_LABEL: Record<FilterField, string> = { priority: 'Priority', status: 'Status', owner: 'Owner' };
const FILTER_FIELD_VALUE: Record<FilterField, (r: UnifiedRequestRow) => string> = {
  priority: r => r.priority,
  status:   r => r.status,
  owner:    r => r.ownerName,
};

const DENSITY_ROW_HEIGHT: Record<Density, { px: number; className: string }> = {
  compact:     { px: 36, className: 'h-9' },
  normal:      { px: 64, className: 'h-16' },
  comfortable: { px: 72, className: 'h-[72px]' },
};

// "request" is locked on in the Columns menu.
const DEFAULT_VISIBLE_COLUMNS = {
  request: true,
  owner: true,
  status: true,
  priority: true,
  amount: true,
  updated: true,
};

const STATUS_OPTIONS: StatusType[] = ['Planning', 'Design', 'Production', 'Quality Control', 'Installation', 'Completed'];

// Platform <Select> drawn like this page's outlined controls (overrides fieldBase's own light/dark look).
const CHIP_SELECT =
  'w-auto cursor-pointer gap-2 rounded-md bg-ui-surface-elevated text-[13px] font-semibold text-[var(--ui-body)] dark:rounded-md dark:border-[var(--ui-divider-strong)] dark:bg-ui-surface-elevated dark:text-[var(--ui-body)] [&_svg]:size-3.5';

// Phone-size outlined buttons (view picker, layout toggle, paging).
const MOBILE_BTN =
  'inline-flex h-10 items-center justify-center gap-2 px-3 rounded-md border border-[var(--color-primary-200)] dark:border-[var(--ui-divider-strong)] bg-ui-surface-elevated font-[family-name:var(--font-ui)] text-[14px] font-semibold text-[var(--ui-body)] hover:bg-[var(--color-primary-50)] dark:hover:bg-white/5 transition-colors';

// Bulk bar buttons — same outlined style as "All views".
// Figma 481:23048 applied-filter chip: 36px, surface fill, navy outline (light) / soft outline (dark), × to remove.
const FILTER_CHIP = 'inline-flex h-9 items-center gap-2 rounded-[6px] border border-[var(--color-secondary-700)] bg-ui-surface px-3 font-[family-name:var(--font-ui)] text-[13px] font-semibold leading-[1.4] text-ui-body dark:border-ui-text-secondary dark:text-ui-heading';
const FILTER_CHIP_X = 'grid place-items-center rounded-[2px] text-current opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring';
// Bulk-bar dropdowns: same panel and hover as the platform's other menus (Select list, row menus).
const BULK_MENU = `${popupBase} absolute right-0 top-full z-30 mt-1 p-1`;
const BULK_MENU_ITEM = 'flex w-full cursor-pointer items-center rounded-[4px] border-0 bg-transparent px-2.5 py-1.5 text-left text-[13px] text-ui-body outline-none transition-colors hover:bg-ui-hover-bg hover:text-ui-heading focus-visible:bg-ui-hover-bg dark:hover:bg-white/10 dark:focus-visible:bg-white/10';
const BULK_BTN =
  'inline-flex h-[30px] items-center justify-center gap-2 px-[9px] rounded-md border border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)] bg-ui-surface-elevated font-[family-name:var(--font-ui)] text-[13px] font-semibold leading-[1.4] text-[var(--ui-body)] hover:bg-[var(--color-primary-50)] dark:hover:bg-white/5 transition-colors';

// Sample fallback items matching the reference specification exactly
const SAMPLE_REQUESTS: UnifiedRequestRow[] = [
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

function mapDocTypeToStatus(docType: string): StatusType {
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

function formatRelativeTime(dateStr: string): string {
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

export function ApprovalsPageClient() {
  const router = useRouter();
  const [items, setItems] = useState<MyApproval[] | null>(null);
  const [userSignature, setUserSignature] = useState<string | null | undefined>(undefined);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Phones get a card list (with paging) by default; the grid button switches to the table.
  const [mobileView, setMobileView] = useState<'cards' | 'table'>('cards');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [cacheBust, setCacheBust] = useState<Record<string, number>>({});
  const pendingApproveRef = useRef<(() => void) | null>(null);

  // Filter and view controls state
  const [activeTab, setActiveTab] = useState<TabKey>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilterOpen, setStatusFilterOpen] = useState(true);
  const [density, setDensity] = useState<Density>('normal');
  const [showDensityMenu, setShowDensityMenu] = useState(false);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [showAllViewsMenu, setShowAllViewsMenu] = useState(false);
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [showAddFilter, setShowAddFilter] = useState(false);
  const [draftField, setDraftField] = useState<FilterField>('priority');
  const [draftValues, setDraftValues] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  // Inline title edit + bulk actions. View-local only: approvals have no
  // rename / status / owner / archive API yet, so changes reset on reload.
  const [rowOverrides, setRowOverrides] = useState<Record<string, RowOverride>>({});
  const [archivedIds, setArchivedIds] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [bulkMenu, setBulkMenu] = useState<'status' | 'owner' | null>(null);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);

  // Sorting state
  const [sortField, setSortField] = useState<'request' | 'owner' | 'status' | 'priority' | 'amount' | 'updated'>('updated');
  const [sortAsc, setSortAsc] = useState(false);

  // Set when /api/approvals/mine fails, so an outage never looks like "no approvals".
  const [loadError, setLoadError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/approvals/mine');
      const json = await res.json().catch(() => ({})) as { approvals?: MyApproval[]; error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not load your approvals.');
      setLoadError(null);
      setItems(json.approvals ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load your approvals.');
      // Keep the last good list on a background refresh; only fall back to empty on first load.
      setItems(prev => prev ?? []);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    fetch('/api/automations/run-approval-reminders', { method: 'POST' }).catch(() => {});
  }, []);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    const iv = setInterval(() => { if (!document.hidden) void load(); }, 30000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(iv); };
  }, [load]);

  useEffect(() => {
    fetch('/api/user/signature')
      .then(r => r.json())
      .then((j: { base64?: string | null }) => setUserSignature(j.base64 ?? null))
      .catch(() => setUserSignature(null));
  }, []);

  function afterAction() {
    void load();
    router.refresh();
  }

  // Convert real approvals into rows
  const mappedRealApprovals = useMemo<UnifiedRequestRow[]>(() => {
    if (!items || items.length === 0) return [];
    return items.map((a, index) => {
      const initials = a.stageLabel
        ? a.stageLabel.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
        : 'TL';
      const parsedTime = new Date(a.createdAt).getTime();
      return {
        id: a.approvalId,
        isRealApproval: true,
        approvalData: a,
        title: `${a.projectName} — ${DOC_LABELS[a.docType] ?? a.docType}`,
        code: `${a.projectCode || 'PRJ'} · V${a.version}`,
        ownerName: a.stageLabel || 'Trust Lines Ops',
        ownerInitials: initials,
        status: mapDocTypeToStatus(a.docType),
        priority: a.stage === 1 ? 'High' : a.stage === a.totalStages ? 'High' : 'Medium',
        amount: 2500 + (index * 1450) % 15000,
        updatedLabel: formatRelativeTime(a.createdAt),
        rawDate: isNaN(parsedTime) ? Date.now() : parsedTime,
      };
    });
  }, [items]);

  // Combined dataset: Real approvals take precedence; if empty, display sample dataset matching the spec
  const allRows = useMemo<UnifiedRequestRow[]>(() => {
    const base = mappedRealApprovals.length > 0 ? mappedRealApprovals : SAMPLE_REQUESTS;
    return base
      .filter(r => !archivedIds[r.id])
      .map(r => (rowOverrides[r.id] ? { ...r, ...rowOverrides[r.id] } : r));
  }, [mappedRealApprovals, archivedIds, rowOverrides]);

  // Filtered & Sorted rows
  const displayedRows = useMemo(() => {
    let rows = [...allRows];

    // Status filter
    if (statusFilterOpen) rows = rowsForTab(rows, activeTab);

    // Added conditions ("Priority is any of High, Medium")
    for (const c of conditions) {
      rows = rows.filter(r => c.values.includes(FILTER_FIELD_VALUE[c.field](r)));
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      rows = rows.filter(
        r =>
          r.title.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.ownerName.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q)
      );
    }

    // Sorting
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'request') cmp = a.title.localeCompare(b.title);
      else if (sortField === 'owner') cmp = a.ownerName.localeCompare(b.ownerName);
      else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortField === 'priority') {
        const pOrder: Record<PriorityLevel, number> = { High: 3, Medium: 2, Low: 1 };
        cmp = pOrder[a.priority] - pOrder[b.priority];
      } else if (sortField === 'amount') cmp = a.amount - b.amount;
      else if (sortField === 'updated') cmp = a.rawDate - b.rawDate;
      return sortAsc ? cmp : -cmp;
    });

    return rows;
  }, [allRows, statusFilterOpen, activeTab, conditions, searchQuery, sortField, sortAsc]);

  const tabCounts = useMemo(
    () => Object.fromEntries(SAVED_VIEWS.map(v => [v.key, rowsForTab(allRows, v.key).length])) as Record<TabKey, number>,
    [allRows],
  );

  const totalCount = allRows.length;
  const isAllSelected = displayedRows.length > 0 && displayedRows.every(r => selectedIds[r.id]);

  function handleSelectAll() {
    if (isAllSelected) {
      setSelectedIds({});
    } else {
      const next: Record<string, boolean> = {};
      displayedRows.forEach(r => { next[r.id] = true; });
      setSelectedIds(next);
    }
  }

  function handleSelectRow(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedIds(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const selectedRows = allRows.filter(r => selectedIds[r.id]);
  const selectedCount = selectedRows.length;
  const isSomeSelected = selectedCount > 0 && !isAllSelected;
  const plural = (n: number) => `${n} request${n === 1 ? '' : 's'}`;

  const ownerOptions = useMemo(() => {
    const seen = new Map<string, string>();
    allRows.forEach(r => { if (!seen.has(r.ownerName)) seen.set(r.ownerName, r.ownerInitials); });
    return [...seen].map(([name, initials]) => ({ name, initials }));
  }, [allRows]);

  function filterValueOptions(field: FilterField): string[] {
    if (field === 'priority') return ['High', 'Medium', 'Low'];
    if (field === 'status') return STATUS_OPTIONS;
    return ownerOptions.map(o => o.name);
  }

  function openAddFilter() {
    setShowAddFilter(v => !v);
    setDraftField('priority');
    setDraftValues(conditions.find(c => c.field === 'priority')?.values ?? []);
  }

  function changeDraftField(field: FilterField) {
    setDraftField(field);
    setDraftValues(conditions.find(c => c.field === field)?.values ?? []);
  }

  function applyFilter() {
    // One condition per field: re-applying a field replaces its values.
    setConditions(prev => [...prev.filter(c => c.field !== draftField), { field: draftField, values: draftValues }]);
    setShowAddFilter(false);
  }

  function selectAllRequests() {
    const next: Record<string, boolean> = {};
    allRows.forEach(r => { next[r.id] = true; });
    setSelectedIds(next);
  }

  function clearSelection() {
    setSelectedIds({});
    setBulkMenu(null);
  }

  function applyToSelected(patch: RowOverride) {
    setRowOverrides(prev => {
      const next = { ...prev };
      selectedRows.forEach(r => { next[r.id] = { ...next[r.id], ...patch }; });
      return next;
    });
    setBulkMenu(null);
  }

  function bulkChangeStatus(status: StatusType) {
    applyToSelected({ status });
    toast.success(`Status set to ${status} for ${plural(selectedCount)}`);
  }

  function bulkAssignOwner(name: string, initials: string) {
    applyToSelected({ ownerName: name, ownerInitials: initials });
    toast.success(`Assigned ${plural(selectedCount)} to ${name}`);
  }

  function bulkArchive() {
    setArchivedIds(prev => {
      const next = { ...prev };
      selectedRows.forEach(r => { next[r.id] = true; });
      return next;
    });
    const archived = selectedRows.map(r => r.id);
    feedback.info(`Archived ${plural(selectedCount)}`, {
      description: 'They are hidden from this list.',
      action: {
        label: 'Undo archive',
        onClick: () => setArchivedIds(prev => {
          const next = { ...prev };
          archived.forEach(id => { delete next[id]; });
          return next;
        }),
      },
    });
    clearSelection();
  }

  function startEdit(row: UnifiedRequestRow) {
    setEditingId(row.id);
    setEditDraft(row.title);
  }

  function saveEdit() {
    const title = editDraft.trim();
    if (editingId && title) {
      setRowOverrides(prev => ({ ...prev, [editingId]: { ...prev[editingId], title } }));
    }
    setEditingId(null);
  }

  function toggleSort(field: 'request' | 'owner' | 'status' | 'priority' | 'amount' | 'updated') {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // default descending
    }
  }

  function handleExport() {
    const headers = ['Request', 'Code', 'Owner', 'Status', 'Priority', 'Amount', 'Updated'];
    const csvContent = [
      headers.join(','),
      ...displayedRows.map(r =>
        [
          `"${r.title.replace(/"/g, '""')}"`,
          `"${r.code}"`,
          `"${r.ownerName}"`,
          `"${r.status}"`,
          `"${r.priority}"`,
          `"${r.amount}"`,
          `"${r.updatedLabel}"`,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `requests_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Export downloaded successfully');
  }

  function renderStatusPill(status: StatusType) {
    // Tone + icon from lib/status/tags.ts (project_stage); chip spacing per design: 3px 10px 3px 8px, gap 4px.
    return (
      <StatusBadge
        group="project_stage"
        status={status}
        className="h-auto gap-1 rounded-[4px] py-[3px] pl-2 pr-[10px] text-xs leading-4 [&_svg]:size-3.5"
      />
    );
  }

  // Card text per Figma 481:23066. Real approvals: project / document type / stage / project code;
  // sample rows (shown only when there are no real approvals): amount / title / request code.
  function cardFields(row: UnifiedRequestRow): { kicker: string; headline: string; ref: string; code: string | null } {
    const a = row.approvalData;
    if (a) {
      const kind = a.catGroup ? a.catGroup.charAt(0).toUpperCase() + a.catGroup.slice(1) : (DOC_LABELS[a.docType] ?? a.docType);
      return { kicker: a.projectName, headline: kind, ref: `Stage ${a.stage}/${a.totalStages}`, code: a.projectCode || null };
    }
    return { kicker: formatAmount(row.amount), headline: row.title, ref: row.code, code: null };
  }

  // Figma card priority: filled chip, chevrons + label (High t10, Medium t7, Low t0).
  function renderPriorityChip(priority: PriorityLevel, small = false) {
    const tone = priority === 'High' ? 't10' : priority === 'Medium' ? 't7' : 't0';
    const Icon = priority === 'High' ? ChevronsUp : priority === 'Medium' ? Equal : ChevronsDown;
    return (
      <span
        className={small ? 'inline-flex shrink-0 items-center gap-1 rounded-[4px] py-[3px] pl-2.5 pr-4 text-[12px] font-medium leading-4' : 'inline-flex h-[33px] shrink-0 items-center gap-1 rounded-[4px] pl-2 pr-2.5 text-[16px] leading-[1.4]'}
        style={{ background: `var(--status-${tone}-bg)`, color: `var(--status-${tone}-fg)` }}
      >
        <Icon className={small ? 'size-3.5' : 'size-[17px]'} aria-hidden />{priority}
      </span>
    );
  }

  function renderPriority(priority: PriorityLevel) {
    if (priority === 'High') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#dc2626] dark:text-error-light">
          <ChevronsUp className="w-3.5 h-3.5" />
          High
        </span>
      );
    }
    if (priority === 'Medium') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#475569] dark:text-ui-body">
          <Equal className="w-3.5 h-3.5" />
          Medium
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#64748b] dark:text-ui-text-secondary">
        <ChevronsDown className="w-3.5 h-3.5" />
        Low
      </span>
    );
  }

  // Row height is fixed per density (compact 36px / normal 64px / comfortable 72px);
  // compact drops the request code and owner avatar so a row fits on one line.
  const isCompact = density === 'compact';
  const paddingClass = isCompact ? 'py-0 px-3' : density === 'comfortable' ? 'py-3 px-4' : 'py-2 px-4';
  const rowHeightClass = DENSITY_ROW_HEIGHT[density].className;

  const proxyUrl = (a: MyApproval) =>
    `/api/files/proxy/${encodeURIComponent(a.fileName)}?documentId=${a.documentId}${cacheBust[a.approvalId] ? `&t=${cacheBust[a.approvalId]}` : ''}`;


  // Shared by the desktop table and the mobile card list.
  const noMatchState = loadError ? (
    <EmptyState
      icon={<X />}
      title="Approvals could not be loaded"
      description={loadError}
      action={
        <Button variant="secondary" className={modalSecondaryButtonClass} onClick={() => void load()}>
          Try again
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={<ListFilter />}
      title="No requests match"
      description="Nothing in this view matches the current search and filters."
      action={(searchQuery || conditions.length > 0 || statusFilterOpen) && (
        <Button
          variant="secondary"
          className={modalSecondaryButtonClass}
          onClick={() => { setSearchQuery(''); setConditions([]); setStatusFilterOpen(false); }}
        >
          Clear filters
        </Button>
      )}
    />
  );

  // Mobile card list paging
  const pageCount = Math.max(1, Math.ceil(displayedRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const pageRows = displayedRows.slice(pageStart, pageStart + pageSize);
  const isPageSelected = pageRows.length > 0 && pageRows.every(r => selectedIds[r.id]);
  const isPagePartlySelected = !isPageSelected && pageRows.some(r => selectedIds[r.id]);

  function togglePageSelection() {
    setSelectedIds(prev => {
      const next = { ...prev };
      pageRows.forEach(r => { if (isPageSelected) delete next[r.id]; else next[r.id] = true; });
      return next;
    });
  }

  const formatAmount = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const savedViewsMenu = showAllViewsMenu && (
    <div className="absolute left-0 top-full mt-1 w-[320px] bg-ui-surface-elevated border border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)] rounded-xl shadow-lg p-2 z-30 font-[family-name:var(--font-ui)] text-[13px] leading-[1.4]">
      <div className="px-2 pt-1 pb-1.5 text-[11px] uppercase tracking-wide text-[var(--ui-text-secondary)]">
        Workspace views
      </div>
      {SAVED_VIEWS.map(v => {
        const active = activeTab === v.key;
        const Icon = v.icon;
        return (
          <button
            key={v.key}
            onClick={() => { setActiveTab(v.key); setStatusFilterOpen(true); setShowAllViewsMenu(false); }}
            className={`w-full flex items-center gap-2.5 h-9 px-2 rounded-md text-left transition-colors ${
              active ? 'bg-[var(--color-primary-50)] dark:bg-[var(--ui-menu-active-bg)] dark:text-[var(--ui-menu-active-fg)] dark:[--ui-body:var(--ui-menu-active-fg)] dark:[--ui-heading:var(--ui-menu-active-fg)] dark:[--ui-text-secondary:var(--ui-menu-active-muted)] font-semibold text-[var(--ui-body)]' : 'text-[var(--ui-body)] hover:bg-[var(--color-primary-50)] dark:hover:bg-white/5'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{v.label}</span>
            <span className="font-normal text-[var(--ui-text-secondary)]">{tabCounts[v.key]}</span>
            <Check className={`w-4 h-4 ${active ? 'text-[var(--ui-body)]' : 'invisible'}`} />
          </button>
        );
      })}

      <div className="my-1.5 border-t border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)]" />

      {/* No saved-view storage yet — shown for the design, disabled until it exists. */}
      <button disabled title="Not available yet" className="w-full flex items-center gap-2.5 h-9 px-2 rounded-md dark:[&_svg]:text-[var(--ui-tab-active)] text-left text-[var(--ui-body)] disabled:cursor-not-allowed disabled:opacity-60">
        <Plus className="w-4 h-4" />
        Save as new view
      </button>
      <button disabled title="Not available yet" className="w-full flex items-center gap-2.5 h-9 px-2 rounded-md dark:[&_svg]:text-[var(--ui-tab-active)] text-left text-[var(--ui-body)] disabled:cursor-not-allowed disabled:opacity-60">
        <Settings2 className="w-4 h-4" />
        Manage views
      </button>

      <div className="mt-1.5 rounded-md bg-[var(--color-primary-50)] dark:border dark:border-[var(--ui-menu-active-border)] dark:bg-[var(--ui-menu-active-bg)] dark:text-[var(--ui-menu-active-fg)] dark:[--ui-body:var(--ui-menu-active-fg)] dark:[--ui-heading:var(--ui-menu-active-fg)] dark:[--ui-text-secondary:var(--ui-menu-active-muted)] px-2.5 py-2 text-xs text-[var(--ui-text-secondary)]">
        {statusFilterOpen ? 'Open status' : 'All statuses'} · {sortField.charAt(0).toUpperCase() + sortField.slice(1)} {sortAsc ? '↑' : '↓'} · {Object.values(visibleColumns).filter(Boolean).length} columns · {density.charAt(0).toUpperCase() + density.slice(1)}
      </div>
    </div>
  );

  const bulkBar = selectedCount > 0 && (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-200 rounded-t-xl font-[family-name:var(--font-ui)] text-[13px] leading-[1.4]">
      <div className="flex items-center gap-4">
        <span className="font-semibold text-[var(--color-secondary-700)] dark:text-[var(--ui-heading)]">{selectedCount} selected</span>
        {selectedCount < allRows.length && (
          <button onClick={selectAllRequests} className="font-normal text-[var(--ui-body)] hover:text-[var(--color-secondary-700)] dark:hover:text-[var(--ui-heading)] transition-colors">
            Select all {plural(allRows.length)}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <button onClick={() => setBulkMenu(bulkMenu === 'status' ? null : 'status')} className={BULK_BTN}>
            Change status
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {bulkMenu === 'status' && (
            <div className={`${BULK_MENU} w-48`}>
              {STATUS_OPTIONS.map(s => (
                <button key={s} type="button" onClick={() => bulkChangeStatus(s)} className={BULK_MENU_ITEM}>
                  {renderStatusPill(s)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button onClick={() => setBulkMenu(bulkMenu === 'owner' ? null : 'owner')} className={BULK_BTN}>
            <UserRound className="w-3.5 h-3.5" />
            Assign owner
          </button>
          {bulkMenu === 'owner' && (
            <div className={`${BULK_MENU} w-52`}>
              {ownerOptions.map(o => (
                <button
                  key={o.name}
                  type="button"
                  onClick={() => bulkAssignOwner(o.name, o.initials)}
                  className={`${BULK_MENU_ITEM} gap-2 font-medium`}
                >
                  <span className="w-5 h-5 rounded-full bg-secondary-100 text-primary-500 dark:bg-secondary-700 dark:text-primary-100 flex items-center justify-center font-semibold text-[9px] shrink-0">
                    {o.initials}
                  </span>
                  {o.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={bulkArchive} className={BULK_BTN}>
          <Archive className="w-3.5 h-3.5" />
          Archive
        </button>

        <button
          onClick={clearSelection}
          className="inline-flex h-[30px] items-center justify-center gap-2 px-[9px] rounded-md border border-[var(--color-error-dark)] bg-[var(--color-error-light)] text-[13px] font-semibold text-[var(--color-error-dark)] hover:brightness-95 transition"
        >
          <X className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>
    </div>
  );

  // Figma 481:23499: a request opens in a centred pop-up (was an inline drawer under the row / card).
  const reviewRow = expandedId ? allRows.find(r => r.id === expandedId) ?? null : null;
  function renderReviewDialog(row: UnifiedRequestRow) {
    const c = cardFields(row);
    const a = row.approvalData;
    return (
      <ApprovalReviewDialog
        key={row.id}
        subtitle={a ? `${a.projectName} - ${c.ref}` : `${c.kicker} - ${row.code}`}
        title={c.code ? `${c.headline} - ${c.code}` : c.headline}
        chips={<>{renderStatusPill(row.status)}{renderPriorityChip(row.priority, true)}</>}
        approval={a ? {
          approvalId: a.approvalId, projectId: a.projectId, fileName: a.fileName, isFinalStage: a.isFinalStage,
          versionNum: a.versionNum, version: a.version, stage: a.stage, totalStages: a.totalStages, stageLabel: a.stageLabel,
        } : null}
        previewUrl={a ? proxyUrl(a) : null}
        uploadedLabel={a ? row.updatedLabel.charAt(0).toLowerCase() + row.updatedLabel.slice(1) : `Updated ${row.updatedLabel.charAt(0).toLowerCase() + row.updatedLabel.slice(1)}`}
        details={a ? undefined : [
          { label: 'Owner', value: row.ownerName }, { label: 'Status', value: row.status },
          { label: 'Priority', value: row.priority }, { label: 'Amount', value: formatAmount(row.amount) },
        ]}
        userSignature={userSignature}
        onNeedSignature={resume => { pendingApproveRef.current = resume; setShowSignaturePad(true); }}
        onPdfSigned={() => { if (a) setCacheBust(p => ({ ...p, [a.approvalId]: Date.now() })); }}
        onDone={() => { setExpandedId(null); afterAction(); }}
        onClose={() => setExpandedId(null)}
      />
    );
  }

  return (
    <div className="w-full px-4 py-6 md:px-6 md:py-8 font-sans text-slate-800">
      {/* ── 1. HEADER SECTION ────────────────────────────────────────── */}
      <div className="mb-6">
        {/* Breadcrumbs */}
        {/* Figma "Approvals" (481:22900): crumb, title + count pill, description; Export + New request. */}
        <div className="flex items-start justify-between gap-4 md:items-center">
          <div className="flex flex-col gap-[5px]">
            <PageCrumbs className="hidden md:block" items={[{ label: 'Operations', href: '/projects' }, { label: 'Approvals', href: '/approvals' }]} />
            <div className="flex items-center gap-2">
              <h1 className="m-0 font-[family-name:var(--font-ui)] text-[28px] font-semibold leading-[1.35] text-[var(--color-secondary-700)] dark:text-ui-heading">
                Approvals
              </h1>
              <span className="hidden md:inline-flex items-center rounded-full bg-ui-surface px-[9px] py-[3px] text-[12px] font-semibold leading-[1.4] text-[var(--color-secondary-700)] dark:text-ui-heading">
                {totalCount}
              </span>
            </div>
            <p className="hidden md:block m-0 text-[13px] leading-[1.35] text-ui-body">
              Track work, review approvals, and keep every request moving.
            </p>
            <p className="md:hidden mt-1 font-[family-name:var(--font-ui)] text-[13px] text-[var(--ui-text-secondary)]">
              {tabCounts.open} open requests · {mobileView === 'cards' ? 'Card view' : 'Table view'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="hidden md:inline-flex h-9 items-center gap-2 rounded-[6px] border border-ui-divider bg-ui-surface-elevated px-3 text-[13px] font-semibold leading-[1.4] text-ui-body hover:bg-ui-hover-bg transition-colors"
            >
              <Download className="size-3.5" />
              Export
            </button>
            <button
              onClick={() => toast.info('New request workflow is linked to project creation.')}
              aria-label="New request"
              className="inline-flex size-11 justify-center items-center gap-2 md:size-auto md:h-9 md:px-3 text-[13px] font-semibold leading-[1.4] text-ui-btn-accent-fg bg-ui-btn-accent hover:opacity-90 rounded-[6px] transition-opacity"
            >
              <Plus className="w-5 h-5 md:size-3.5" />
              <span className="hidden md:inline">New request</span>
            </button>
          </div>
        </div>
      </div>

      {/* Signature setup notice if user has not set up signature */}
      {userSignature === null && (
        <div className="flex items-center justify-between gap-4 p-3.5 mb-5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-base">✍️</span>
            <div>
              <span className="font-semibold">Set up your approval signature: </span>
              <span className="text-amber-800">Your drawn signature will be automatically stamped on verified PDFs.</span>
            </div>
          </div>
          <button
            onClick={() => setShowSignaturePad(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-md text-xs shrink-0 transition-colors"
          >
            Set up now
          </button>
        </div>
      )}

      {/* ── 2. TABS & SAVED ROW ───────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 mb-3 md:hidden">
        <div className="relative">
          <button onClick={() => setShowAllViewsMenu(!showAllViewsMenu)} className={MOBILE_BTN}>
            <ListFilter className="w-4 h-4" />
            {SAVED_VIEWS.find(v => v.key === activeTab)?.label}
            <ChevronDown className="w-4 h-4" />
          </button>
          {savedViewsMenu}
        </div>
        <button
          onClick={() => setMobileView(v => (v === 'cards' ? 'table' : 'cards'))}
          aria-label={mobileView === 'cards' ? 'Show as table' : 'Show as cards'}
          title={mobileView === 'cards' ? 'Show as table' : 'Show as cards'}
          className={`${MOBILE_BTN} w-10 px-0`}
        >
          {mobileView === 'cards' ? <Rows3 className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
        </button>
      </div>


      {/* ── 3. CONTROLS: SEARCH, FILTERS & VIEW OPTIONS ───────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {/* Left: Search input, filter chip, Add filter button */}
        <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
          {/* Figma 481:23044: 36px search, 278px wide. */}
          <div className="relative w-full sm:w-[278px]">
            <Search className="size-4 text-ui-body absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search requests..."
              aria-label="Search requests"
              className="h-9 w-full rounded-[6px] border border-ui-input-border bg-ui-input-bg pl-[38px] pr-3 text-[13px] text-ui-heading placeholder:text-ui-text-secondary outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-ui-focus-ring"
            />
          </div>

          {statusFilterOpen && (
            <div className={FILTER_CHIP}>
              <span>Status: Open</span>
              <button
                type="button"
                onClick={() => setStatusFilterOpen(false)}
                className={FILTER_CHIP_X}
                title="Remove filter"
                aria-label="Remove Status: Open filter"
              >
                <X className="size-[13px]" />
              </button>
            </div>
          )}

          {conditions.map(c => (
            <div key={c.field} className={FILTER_CHIP}>
              <span>{FILTER_FIELD_LABEL[c.field]}: {c.values.join(', ')}</span>
              <button
                type="button"
                onClick={() => setConditions(prev => prev.filter(x => x.field !== c.field))}
                className={FILTER_CHIP_X}
                title="Remove filter"
                aria-label={`Remove ${FILTER_FIELD_LABEL[c.field]} filter`}
              >
                <X className="size-[13px]" />
              </button>
            </div>
          ))}

          <div className="relative">
          <button
            type="button"
            onClick={openAddFilter}
            // Figma 481:23052: 36px filled primary — navy with white text, light fill with dark text in dark mode.
            className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-ui-divider bg-[var(--color-secondary-700)] px-3 font-[family-name:var(--font-ui)] text-[13px] font-semibold leading-[1.4] text-white transition-colors hover:bg-[var(--color-secondary-600)] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ui-focus-ring dark:border-transparent dark:bg-primary-50 dark:text-primary-950 dark:hover:bg-primary-100"
          >
            {/* square-dashed-plus icon (design export) */}
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
              <path d="M2.91667 1.75C2.60725 1.75 2.3105 1.87292 2.09171 2.09171C1.87292 2.3105 1.75 2.60725 1.75 2.91667M11.0833 1.75C11.3928 1.75 11.6895 1.87292 11.9083 2.09171C12.1271 2.3105 12.25 2.60725 12.25 2.91667M12.25 11.0833C12.25 11.3928 12.1271 11.6895 11.9083 11.9083C11.6895 12.1271 11.3928 12.25 11.0833 12.25M2.91667 12.25C2.60725 12.25 2.3105 12.1271 2.09171 11.9083C1.87292 11.6895 1.75 11.3928 1.75 11.0833M5.25 1.75H5.83333M5.25 12.25H5.83333M8.16667 1.75H8.75M8.16667 12.25H8.75M1.75 5.25V5.83333M12.25 5.25V5.83333M1.75 8.16667V8.75M12.25 8.16667V8.75M7 4.66667V7M7 7V9.33333M7 7H4.66667M7 7H9.33333" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor" />
            </svg>
            Add filter
          </button>

          {showAddFilter && (
            <div className="absolute left-0 top-full mt-1 w-[340px] bg-ui-surface-elevated border border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)] rounded-xl shadow-lg p-4 z-30 font-[family-name:var(--font-ui)] text-[13px] leading-[1.4]">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-[var(--ui-body)]">Add a condition</span>
                <button onClick={() => setShowAddFilter(false)} title="Close" className="text-[var(--ui-body)] hover:text-[var(--color-secondary-700)] dark:hover:text-[var(--ui-heading)]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <FilterSelect
                  aria-label="Filter field"
                  value={draftField}
                  onValueChange={v => { if (v) changeDraftField(v as FilterField); }}
                  options={(Object.keys(FILTER_FIELD_LABEL) as FilterField[]).map(f => ({ value: f, label: FILTER_FIELD_LABEL[f] }))}
                  className={`${CHIP_SELECT} h-[34px] border-[var(--color-primary-100)] pl-3 pr-2.5 dark:pl-3 dark:pr-2.5`}
                />
                {/* Only operator for now */}
                <div className="inline-flex h-[34px] items-center px-3 rounded-md border border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)] font-semibold text-[var(--ui-body)]">
                  is any of
                </div>
              </div>

              <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                {filterValueOptions(draftField).map(value => {
                  const checked = draftValues.includes(value);
                  return (
                    <label
                      key={value}
                      className={`flex items-center gap-2.5 h-9 px-2.5 rounded-md cursor-pointer ${
                        checked ? 'bg-[var(--color-primary-50)] dark:bg-[var(--ui-row-checked)]' : 'hover:bg-[var(--color-primary-50)] dark:hover:bg-white/5'
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() =>
                          setDraftValues(prev => (checked ? prev.filter(v => v !== value) : [...prev, value]))
                        }
                      />
                      <span className={checked ? 'font-semibold text-[var(--ui-body)] dark:text-[var(--ui-heading)]' : 'text-[var(--ui-text-secondary)]'}>
                        {value}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-3 pt-3 border-t border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)] flex items-center justify-between">
                <span className="text-xs text-[var(--ui-text-secondary)]">
                  {draftValues.length} value{draftValues.length === 1 ? '' : 's'} selected
                </span>
                <Button type="button" variant="primary" onClick={applyFilter} disabled={draftValues.length === 0}>
                  Apply filter
                </Button>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Right: Columns dropdown & Density dropdown (desktop table view only) */}
        <div className={`${mobileView === 'table' ? 'hidden md:flex' : 'hidden'} items-center gap-2`}>
          {/* Columns Selector */}
          <div className="relative">
            <button
              onClick={() => { setShowColumnsMenu(!showColumnsMenu); setShowDensityMenu(false); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ui-surface-elevated border border-slate-200 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs dark:bg-transparent dark:border-[var(--ui-body)] dark:text-[var(--ui-heading)] dark:hover:bg-white/5"
            >
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              Columns
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {showColumnsMenu && (
              <div className="absolute right-0 top-full mt-1 w-[300px] bg-ui-surface-elevated border border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)] rounded-xl shadow-lg p-2 z-30 font-[family-name:var(--font-ui)] text-[13px] leading-[1.4]">
                <div className="flex items-center justify-between px-2 pt-1 pb-2">
                  <span className="font-semibold text-[var(--ui-body)] dark:text-[var(--ui-heading)]">
                    Columns · {Object.values(visibleColumns).filter(Boolean).length} of {Object.keys(visibleColumns).length} visible
                  </span>
                  <button
                    onClick={() => setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)}
                    className="text-[var(--ui-text-secondary)] hover:text-[var(--ui-body)] transition-colors"
                  >
                    Reset
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  {(Object.keys(visibleColumns) as (keyof typeof visibleColumns)[]).map(col => {
                    const checked = visibleColumns[col];
                    const locked = col === 'request';
                    return (
                      <label
                        key={col}
                        className={`flex items-center gap-2.5 h-9 px-2 rounded-md capitalize ${
                          locked ? 'bg-[var(--color-primary-50)] dark:bg-[var(--ui-row-locked)]' : checked ? 'bg-[var(--color-primary-50)] dark:bg-[var(--ui-row-checked)]' : 'hover:bg-[var(--color-primary-50)] dark:hover:bg-white/5'
                        } ${locked ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={locked}
                          onCheckedChange={() => setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }))}
                        />
                        <span className={locked ? 'font-semibold text-[var(--ui-body)] dark:font-normal dark:text-[var(--ui-text-secondary)]' : checked ? 'font-semibold text-[var(--ui-body)] dark:text-[var(--ui-heading)]' : 'font-normal text-[var(--ui-text-secondary)]'}>
                          {col}
                        </span>
                        {locked && <span className="ml-auto text-[var(--ui-text-secondary)] normal-case">Locked</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Density Selector */}
          <div className="relative">
            <button
              onClick={() => { setShowDensityMenu(!showDensityMenu); setShowColumnsMenu(false); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ui-surface-elevated border border-slate-200 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs dark:bg-transparent dark:border-[var(--ui-body)] dark:text-[var(--ui-heading)] dark:hover:bg-white/5 capitalize"
            >
              <List className="w-3.5 h-3.5 text-slate-500" />
              {density}
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {showDensityMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-ui-surface-elevated border border-slate-200 rounded-lg shadow-lg py-1 z-30 text-xs">
                {(['compact', 'normal', 'comfortable'] as Density[]).map(d => (
                  <button
                    key={d}
                    onClick={() => { setDensity(d); setShowDensityMenu(false); }}
                    className={`w-full text-left px-3 py-1.5 capitalize flex items-center justify-between ${
                      density === d ? 'font-semibold text-slate-900 bg-slate-50' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{d} · {DENSITY_ROW_HEIGHT[d].px} px</span>
                    {density === d && <Check className="w-3 h-3 text-slate-800" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Figma 481:23055 "Saved views": filled pill tabs with counts, under the filters; view toggle on the right. */}
      <div className="hidden md:flex items-center justify-between gap-3 border-b border-ui-divider pb-3 mb-6">
        <div role="tablist" aria-label="Saved views" className="flex items-center gap-2">
          {SAVED_VIEWS.map(v => {
            const on = activeTab === v.key;
            return (
              <button
                key={v.key} type="button" role="tab" aria-selected={on} onClick={() => setActiveTab(v.key)}
                className={`inline-flex h-[38px] items-center gap-2 rounded-[6px] px-4 font-[family-name:var(--font-ui)] text-[13px] leading-normal text-[var(--color-secondary-700)] dark:text-ui-heading transition-colors ${
                  on ? 'bg-ui-selected-bg font-semibold' : 'bg-ui-page-bg font-medium hover:bg-ui-hover-bg'
                }`}
              >
                {v.key === 'open' ? 'All' : v.label}
                <span className="text-[12px] font-normal leading-[1.4] text-ui-text-secondary">{tabCounts[v.key]}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Layout">
          {([['cards', LayoutGrid, 'Cards'], ['table', Rows3, 'Table']] as const).map(([k, Icon, label]) => (
            <button
              key={k} type="button" onClick={() => setMobileView(k)} aria-pressed={mobileView === k} title={`${label} view`} aria-label={`${label} view`}
              className={`grid size-9 place-items-center rounded-[6px] border transition-colors ${mobileView === k ? 'border-ui-divider bg-ui-selected-bg text-[var(--color-secondary-700)] dark:text-ui-heading' : 'border-transparent text-ui-body hover:bg-ui-hover-bg'}`}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </div>
      {/* ── 4. TABLE CONTAINER ────────────────────────────────────────── */}
      <div className={`border border-slate-200 rounded-xl bg-ui-surface-elevated shadow-2xs ${mobileView === 'cards' ? 'hidden' : ''}`}>
        {bulkBar}

        {/* Scrolls inside the card; column headings stay pinned (sticky th). */}
        <div className={`overflow-auto max-h-[calc(100vh-260px)] min-h-[200px] ${selectedCount > 0 ? 'rounded-b-xl' : 'rounded-xl'}`}>
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-slate-50 [&_th]:shadow-[inset_0_-1px_0_#e2e8f0]">
              <tr className="text-xs font-medium text-slate-500 select-none">
                <th className="w-10 px-4 py-3 text-center">
                  <Checkbox
                    checked={isAllSelected}
                    indeterminate={isSomeSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all requests"
                  />
                </th>

                {visibleColumns.request && (
                  <th
                    onClick={() => toggleSort('request')}
                    className="px-4 py-3 cursor-pointer hover:text-slate-800 transition-colors min-w-[280px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Request</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}

                {visibleColumns.owner && (
                  <th
                    onClick={() => toggleSort('owner')}
                    className="px-4 py-3 cursor-pointer hover:text-slate-800 transition-colors min-w-[150px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Owner</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}

                {visibleColumns.status && (
                  <th
                    onClick={() => toggleSort('status')}
                    className="px-4 py-3 cursor-pointer hover:text-slate-800 transition-colors min-w-[130px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Status</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}

                {visibleColumns.priority && (
                  <th
                    onClick={() => toggleSort('priority')}
                    className="px-4 py-3 cursor-pointer hover:text-slate-800 transition-colors min-w-[110px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Priority</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}

                {visibleColumns.amount && (
                  <th
                    onClick={() => toggleSort('amount')}
                    className="px-4 py-3 cursor-pointer hover:text-slate-800 transition-colors min-w-[120px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Amount</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                )}

                {visibleColumns.updated && (
                  <th
                    onClick={() => toggleSort('updated')}
                    className="px-4 py-3 cursor-pointer hover:text-slate-800 transition-colors min-w-[130px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Updated</span>
                      {sortField === 'updated' ? (
                        sortAsc ? <ArrowUp className="w-3 h-3 text-slate-600" /> : <ArrowDown className="w-3 h-3 text-slate-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                )}

                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>

            {/* border-separate (needed for sticky th) ignores tr borders, so dividers sit on cells. */}
            <tbody className="text-sm [&>tr:not(:first-child)>td]:border-t [&>tr>td]:border-slate-100">
              {displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    {noMatchState}
                  </td>
                </tr>
              ) : (
                displayedRows.map(row => {
                  const isExpanded = expandedId === row.id;
                  const isSelected = !!selectedIds[row.id];

                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : row.id)}
                        className={`group cursor-pointer transition-colors ${rowHeightClass} ${
                          isSelected
                            ? 'bg-[var(--ui-selected-bg)]'
                            : isExpanded ? 'bg-slate-50/50 hover:bg-slate-50/70' : 'bg-ui-surface-elevated hover:bg-slate-50/70'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className={`w-10 px-4 ${paddingClass} text-center`} onClick={e => handleSelectRow(row.id, e)}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => {}}
                            aria-label={`Select request ${row.code}`}
                          />
                        </td>

                        {/* Request Title & Code */}
                        {visibleColumns.request && (
                          <td className={`px-4 ${paddingClass}`}>
                            {editingId === row.id ? (
                              <div
                                onClick={e => e.stopPropagation()}
                                className="flex h-8 items-center gap-1.5 rounded-md border-2 border-[var(--color-secondary-700)] dark:border-[var(--ui-tab-active)] bg-ui-surface-elevated dark:bg-[var(--bg-sunken)] pl-2 pr-1.5"
                              >
                                <input
                                  autoFocus
                                  value={editDraft}
                                  onChange={e => setEditDraft(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveEdit();
                                    else if (e.key === 'Escape') setEditingId(null);
                                  }}
                                  aria-label={`Edit title of ${row.code}`}
                                  className="min-w-0 flex-1 bg-transparent outline-none dark:selection:bg-[var(--ui-tab-badge)] dark:selection:text-white font-[family-name:var(--font-ui)] text-[13px] leading-[1.4] text-[var(--color-secondary-700)] dark:text-[var(--ui-heading)]"
                                />
                                <button onClick={saveEdit} title="Save (Enter)" className="text-[var(--ui-body)] hover:text-[var(--color-secondary-700)] dark:hover:text-[var(--ui-heading)]">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setEditingId(null)} title="Cancel (Esc)" className="text-[var(--ui-body)] hover:text-[var(--color-secondary-700)] dark:hover:text-[var(--ui-heading)]">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-baseline gap-1.5">
                                  <span className="font-[family-name:var(--font-ui)] text-[13px] font-semibold leading-[1.4] text-[var(--ui-body)]">
                                    {row.title}
                                  </span>
                                  <button
                                    onClick={e => { e.stopPropagation(); startEdit(row); }}
                                    title="Edit title"
                                    aria-label={`Edit title of ${row.code}`}
                                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                                  >
                                    <Pencil className="w-3 h-3 text-slate-400" />
                                  </button>
                                </div>
                                {!isCompact && (
                                  <div className="text-xs font-mono text-slate-400 mt-0.5">
                                    {row.code}
                                  </div>
                                )}
                              </>
                            )}
                          </td>
                        )}

                        {/* Owner */}
                        {visibleColumns.owner && (
                          <td className={`px-4 ${paddingClass}`}>
                            <div className="flex items-center gap-2">
                              {!isCompact && (
                                <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-semibold text-[10px] shrink-0">
                                  {row.ownerInitials}
                                </div>
                              )}
                              <span className="text-xs font-medium text-slate-700 whitespace-nowrap">
                                {row.ownerName}
                              </span>
                            </div>
                          </td>
                        )}

                        {/* Status */}
                        {visibleColumns.status && (
                          <td className={`px-4 ${paddingClass} whitespace-nowrap`}>
                            {renderStatusPill(row.status)}
                          </td>
                        )}

                        {/* Priority */}
                        {visibleColumns.priority && (
                          <td className={`px-4 ${paddingClass} whitespace-nowrap`}>
                            {renderPriority(row.priority)}
                          </td>
                        )}

                        {/* Amount */}
                        {visibleColumns.amount && (
                          <td className={`px-4 ${paddingClass} font-mono text-xs font-medium text-slate-700 whitespace-nowrap`}>
                            ${row.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        )}

                        {/* Updated */}
                        {visibleColumns.updated && (
                          <td className={`px-4 ${paddingClass} text-xs text-slate-500 whitespace-nowrap`}>
                            {row.updatedLabel}
                          </td>
                        )}

                        {/* Actions */}
                        <td className={`w-10 px-4 ${paddingClass} text-right`} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : row.id)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="Inspect details"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>

                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4b. MOBILE CARD LIST ───────────────────────────────────────── */}
      {mobileView === 'cards' && (
        <div className="font-[family-name:var(--font-ui)]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <label className="flex items-center gap-2 text-[13px] text-[var(--ui-text-secondary)]">
              <Checkbox
                checked={isPageSelected}
                indeterminate={isPagePartlySelected}
                onCheckedChange={togglePageSelection}
              />
              Select page
            </label>
            <div className="relative inline-flex h-9 items-center rounded-md border border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)] bg-ui-surface-elevated text-[13px] font-semibold text-[var(--ui-body)]">
              <button
                onClick={() => setSortAsc(a => !a)}
                aria-label={sortAsc ? 'Sort descending' : 'Sort ascending'}
                className="h-full pl-2.5 pr-1"
              >
                {sortAsc ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              </button>
              <FilterSelect
                aria-label="Sort by"
                value={sortField}
                onValueChange={v => { if (v) setSortField(v as typeof sortField); }}
                options={(['updated', 'request', 'owner', 'status', 'priority', 'amount'] as const).map(f => ({ value: f, label: f.charAt(0).toUpperCase() + f.slice(1) }))}
                className={`${CHIP_SELECT} h-full border-0 bg-transparent pl-1 pr-2.5 hover:border-0 dark:border-0 dark:bg-transparent dark:pl-1 dark:pr-2.5`}
              />
            </div>
          </div>

          {bulkBar && <div className="mb-3 rounded-xl border border-slate-200 bg-ui-surface-elevated">{bulkBar}</div>}

          {pageRows.length === 0 ? (
            <div className="rounded-xl border border-[var(--color-primary-100)] dark:border-[var(--ui-divider-strong)] bg-ui-surface-elevated">{noMatchState}</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pageRows.map(row => {
                const isSelected = !!selectedIds[row.id];
                const isExpanded = expandedId === row.id;
                const c = cardFields(row);
                return (
                  <React.Fragment key={row.id}>
                    {/* Figma 481:23066 request card: kicker + status chip + ref chip / big headline + code / waiting on + priority. */}
                    <div
                      role="button" tabIndex={0} aria-expanded={isExpanded}
                      onClick={() => setExpandedId(isExpanded ? null : row.id)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(isExpanded ? null : row.id); } }}
                      className={`flex min-h-[191px] cursor-pointer flex-col justify-between gap-4 rounded-[16px] border py-3.5 pl-3.5 pr-4 text-left outline-none transition-colors focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ui-focus-ring ${
                        isSelected ? 'border-[var(--color-secondary-200)] bg-[var(--ui-selected-bg)]' : isExpanded ? 'border-[var(--color-secondary-700)] bg-ui-surface dark:border-ui-heading' : 'border-ui-divider bg-ui-surface hover:border-ui-text-secondary'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-4">
                          <Checkbox
                            checked={isSelected}
                            onClick={e => e.stopPropagation()}
                            onKeyDown={e => e.stopPropagation()}
                            onCheckedChange={() => setSelectedIds(prev => ({ ...prev, [row.id]: !prev[row.id] }))}
                            aria-label={`Select request ${row.code}`}
                          />
                          <span className="truncate text-[16px] font-medium tracking-[0.64px] text-[var(--color-secondary-700)] dark:text-ui-heading">{c.kicker}</span>
                          <span className="shrink-0">{renderStatusPill(row.status)}</span>
                        </div>
                        <span className="shrink-0 rounded-[4px] bg-ui-surface-elevated px-2.5 py-0.5 text-[14px] font-medium leading-[1.5] tracking-[0.56px] text-[var(--color-secondary-700)] dark:text-ui-heading">{c.ref}</span>
                      </div>

                      <div className="flex min-w-0 items-center justify-between gap-4 text-[clamp(22px,2.1vw,32px)] font-medium leading-normal tracking-[0.04em] text-[var(--color-secondary-700)] dark:text-ui-heading">
                        <span className="min-w-0 truncate">{c.headline}</span>
                        {c.code && <span className="shrink-0">{c.code}</span>}
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-col">
                          <span className="text-[12px] tracking-[0.48px] text-ui-text-secondary">Waiting on:</span>
                          <span className="truncate text-[16px] font-medium tracking-[0.64px] text-[var(--color-secondary-700)] dark:text-ui-heading">{row.ownerName}</span>
                        </div>
                        {renderPriorityChip(row.priority)}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3 text-[13px] text-[var(--ui-text-secondary)]">
            <span>
              {displayedRows.length === 0 ? 0 : pageStart + 1}–{pageStart + pageRows.length} of {plural(displayedRows.length)}
            </span>
            <FilterSelect
              aria-label="Requests per page"
              value={String(pageSize)}
              onValueChange={v => { if (v) { setPageSize(Number(v)); setPage(1); } }}
              options={[10, 25, 50].map(n => ({ value: String(n), label: `${n} per page` }))}
              className={`${CHIP_SELECT} h-9 border-[var(--color-primary-100)] px-2.5 dark:px-2.5`}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className={`${MOBILE_BTN} disabled:opacity-50`}
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-[13px] text-[var(--ui-text-secondary)]">{currentPage} of {pageCount}</span>
            <button
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= pageCount}
              className={`${MOBILE_BTN} disabled:opacity-50`}
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── 5. FOOTER SORT CAPTION (desktop) ───────────────────────────── */}
      {mobileView !== 'table' ? null : selectedCount > 0 || editingId ? (
        <div className="hidden md:flex items-center gap-2 mt-3 text-xs text-slate-400 select-none">
          <CornerDownLeft className="w-3.5 h-3.5 text-slate-400" />
          <span>Enter to save · Esc to cancel · Focus stays in the edited cell. Bulk actions apply only to selected requests.</span>
        </div>
      ) : (
        <div className="hidden md:flex items-center gap-2 mt-3 text-xs text-slate-400 select-none">
          <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
          <span>Updated, newest first · Click a column header to sort</span>
        </div>
      )}

      {reviewRow && renderReviewDialog(reviewRow)}

      {/* ── 6. SIGNATURE PAD MODAL ─────────────────────────────────────── */}
      {showSignaturePad && (
        <SignaturePad
          existingBase64={userSignature ?? null}
          onSaved={base64 => {
            setUserSignature(base64);
            setShowSignaturePad(false);
            const resume = pendingApproveRef.current;
            pendingApproveRef.current = null;
            if (resume) setTimeout(resume, 50);
          }}
          onClose={() => {
            setShowSignaturePad(false);
            pendingApproveRef.current = null;
          }}
        />
      )}
    </div>
  );
}
