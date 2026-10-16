import { approvalStagesFor } from '@/lib/approvals/stageConfig';

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

export function DocStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, [string, string, string]> = {
    approved:         ['var(--status-success-bg)', 'var(--status-success)', 'Approved'],
    rejected:         ['var(--status-danger-bg)', 'var(--status-danger)', 'Rejected'],
    pending_approval: ['var(--status-warning-bg)', 'var(--status-warning)', 'Pending Review'],
    draft:            ['var(--bg-sunken)', 'var(--fg-muted)', 'Draft'],
    revised:          ['var(--phase-5-bg)', 'var(--phase-5)', 'Revised'],
    signed:           ['var(--status-info-bg)', 'var(--status-info)', 'Signed'],
  };
  const [bg, color, label] = cfg[status] ?? cfg.draft;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 99,
      fontSize: 10, fontWeight: 700, background: bg, color,
    }}>
      {label}
    </span>
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
