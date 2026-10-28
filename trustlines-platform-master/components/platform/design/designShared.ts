import type { SalesDesignJob } from '@/types/database';
import type { LeadBrief, ProjectMeta } from '@/app/(platform)/design/page';

// Shared by the Design workspace page and its job panel.

export const HEADING = 'text-[var(--color-secondary-700)] dark:text-ui-heading';
export const FILTER_CLS = 'inline-flex h-9 w-auto shrink-0 cursor-pointer items-center gap-1 rounded-[6px] border border-[var(--ui-input-border)] bg-ui-input-bg pl-3 pr-2 text-[13px] font-medium leading-normal text-[var(--color-secondary-700)] dark:rounded-[6px] dark:text-ui-heading [&_svg]:size-3.5';

export const JOB_STATUS_ORDER = [
  'awaiting_assignment', 'assigned', 'working_on_it', 'ready_for_sales_review',
  'revision_requested', 'approved_by_sales', 'presented_to_customer', 'completed', 'cancelled',
] as const;
/** What a designer may move their own job to (Sales/managers can set any status). */
export const DESIGNER_STATUSES = ['assigned', 'working_on_it', 'ready_for_sales_review'];
export const OPEN_STATUSES = new Set(['awaiting_assignment', 'assigned', 'working_on_it', 'ready_for_sales_review', 'revision_requested']);
export const VERSION_STATUSES = ['draft', 'submitted', 'presented', 'approved', 'revision_requested', 'rejected'];

export const JOB_STATUS_LABEL: Record<string, string> = {
  awaiting_assignment: 'Awaiting designer', assigned: 'Assigned', working_on_it: 'Working on it',
  ready_for_sales_review: 'Sales review', revision_requested: 'Revision', approved_by_sales: 'Approved',
  presented_to_customer: 'With customer', completed: 'Completed', cancelled: 'Cancelled',
};
export const VERSION_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', submitted: 'Sent to Sales', presented: 'With customer', approved: 'Approved',
  revision_requested: 'Revision', rejected: 'Rejected',
};

export function anchorId(job: Pick<SalesDesignJob, 'lead_intake_id' | 'opportunity_id'>): string {
  return job.lead_intake_id ?? job.opportunity_id ?? '';
}

export function projectName(brief: LeadBrief | undefined, meta: ProjectMeta | undefined, fallback: string): string {
  const who = brief?.customer_name?.trim() || brief?.brand?.trim();
  const where = brief ? [brief.city, brief.state].filter(Boolean).join(', ') : '';
  const label = [who, where].filter(Boolean).join(' · ');
  if (meta?.code && label) return `${meta.code} — ${label}`;
  if (meta?.code) return meta.code;
  return label || fallback.replace(/^Sales Design\s+[—-]\s+/i, '');
}

/** Local YYYY-MM-DD. */
export function localYmd(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function initials(name: string | null | undefined): string {
  return (name ?? '').split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase() || '—';
}

export function formatBytes(n: number | null): string {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
