import type { HandoverChecklistItem } from '@/types/database';

export const DEFAULT_HANDOVER_ITEMS: { key: string; label: string }[] = [
  { key: 'tlines_pm_assigned',   label: 'T-Lines PM assigned' },
  { key: 'trustlines_pm_assigned', label: 'Trust Lines PM assigned' },
  { key: 'pm_supervisor',        label: 'PM Supervisor assigned (if needed)' },
  { key: 'dropbox_folder',       label: 'Dropbox project folder created' },
  { key: 'customer_linked',      label: 'Customer & contacts linked' },
  { key: 'sales_files',          label: 'Sales files associated with the project' },
  { key: 'budget_scope',         label: 'Budget & scope confirmed' },
  { key: 'closed_deal_recorded', label: 'Closed deal date recorded' },
  { key: 'handover_meeting',     label: 'Handover meeting scheduled' },
];

export function defaultChecklist(): HandoverChecklistItem[] {
  return DEFAULT_HANDOVER_ITEMS.map(i => ({ key: i.key, label: i.label, done: false, done_at: null, done_by: null }));
}

export const AUTO_HANDOVER_KEYS = new Set([
  'tlines_pm_assigned', 'trustlines_pm_assigned', 'pm_supervisor', 'dropbox_folder',
  'customer_linked', 'sales_files', 'closed_deal_recorded', 'handover_meeting',
]);

export interface HandoverSignals {
  tlines_pm_id: string | null;
  trustlines_pm_id: string | null;
  pm_supervisor_id: string | null;
  dropbox_root_path: string | null;
  customer_id: string | null;
  closed_deal_date: string | null;
  documentCount: number;
  meetingAt: string | null;
}

export function deriveHandover(s: HandoverSignals): Record<string, boolean> {
  return {
    tlines_pm_assigned:   !!s.tlines_pm_id,
    trustlines_pm_assigned: !!s.trustlines_pm_id,
    pm_supervisor:        !!s.pm_supervisor_id,
    dropbox_folder:       !!s.dropbox_root_path,
    customer_linked:      !!s.customer_id,
    sales_files:          s.documentCount > 0,
    closed_deal_recorded: !!s.closed_deal_date,
    handover_meeting:     !!s.meetingAt,
  };
}

export const HANDOVER_READ_ROLES = [
  'ops_manager', 'general_manager', 'trustlines_pm', 'tlines_pm', 'pm_millwork', 'pm_ceiling', 'sales_rep', 'sales_marketing_manager',
];
export const HANDOVER_WRITE_ROLES = [
  'ops_manager', 'general_manager', 'trustlines_pm', 'tlines_pm',
];
