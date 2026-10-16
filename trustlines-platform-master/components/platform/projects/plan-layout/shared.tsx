import { approvalStagesFor } from '@/lib/approvals/stageConfig';
import { StatusBadge as TagBadge } from '@/components/ui/status-badge';
import { DOC_STATUS_TAG } from '@/lib/status/tags';

export interface ApprovalRow {
  id:          string;
  stage:       number;
  status:      string;
  assigned_to: string | null;
  approved_by: string | null;
  notes:       string | null;
  created_at:  string;
  resolved_at: string | null;
  version_num: number | null;
}

/** An Item List version offered for "Open for Pricing" on the Price List tab. */
export interface ILVer { id: string; version: number; file_name: string; form_data: unknown[] | null }

export function DropboxIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.85} viewBox="0 0 24 20" fill="#0061FF">
      <path d="M6 0L0 4l6 4 6-4L6 0zm12 0l-6 4 6 4 6-4-6-4zM0 12l6 4 6-4-6-4-6 4zm18-4l-6 4 6 4 6-4-6-4zM6 17l6 3 6-3-6-4-6 4z" />
    </svg>
  );
}

const DOC_STATUS_LABEL: Record<string, string> = {
  approved: 'Approved', rejected: 'Rejected', pending_approval: 'Pending Review',
  draft: 'Draft', revised: 'Revised', signed: 'Signed',
};

export function DocStatusBadge({ status }: { status: string }) {
  // Colour + icon from lib/status/tags.ts (DOC_STATUS_TAG); the label stays the app's own status name.
  return (
    <TagBadge
      group="approval"
      status={DOC_STATUS_TAG[status] ?? status}
      size="sm"
      label={DOC_STATUS_LABEL[status] ?? DOC_STATUS_LABEL.draft}
    />
  );
}

export const toolBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28, borderRadius: 5, border: '1px solid var(--border-default)',
  background: 'white', cursor: 'pointer', color: 'var(--fg-muted)',
};

export function getApprovalStages(docType: string, catGroup?: string | null) {
  return approvalStagesFor(docType, catGroup ?? null).map(s => ({ label: s.label, hint: s.hint }));
}

export function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
