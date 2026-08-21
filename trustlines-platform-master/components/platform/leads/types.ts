
export type OpportunityStatus =
  | 'new_opportunity'
  | 'ready_to_start'
  | 'modification_request'
  | 'working_on_it_trust'
  | 'design_proposal_sent'
  | 'waiting_from_op'
  | 'contract_stage'
  | 'waiting'
  | 'deal_closed'
  | 'deal_missed'
  | 'potential'
  | 'in_target_list';

export type Priority = 'low' | 'medium' | 'high';

export interface Lead {
  id: string;
  name: string;
  project_no?: string | null;
  industry: string;
  brand: string;
  state: string;
  priority: Priority;
  assignee_id?: string | null;
  opportunity_status: OpportunityStatus;
  to_do: string;
  contact: string;
  assignee: string;
  design_status: string;
  request: string;
  project_type: string;
  deal_size?: number | null;
  follow_up_date?: string | null;
  tags?: string[];
  tag_pills?: { name: string; color: string }[];
  checklist_done?: number;
  checklist_total?: number;
  tasks_done?: number;
  tasks_total?: number;
  archived?: boolean;
  location: string;
  date_created: string;
  date_done?: string | null;
  source: string;
  due_date?: string | null;
  deposit?: number | null;
  payment_raw?: string | null;
  targeted?: boolean;
  external_stage_label?: string | null;
  origin?: 'lead_intake' | 'opportunity' | 'potential';
  region?: string | null;
  prospect_id?: string | null;
}

export interface StatusMeta {
  key: OpportunityStatus;
  label: string;
  bg: string;
  fg: string;
  dot: string;
}

export const STATUS_ORDER: StatusMeta[] = [
  { key: 'potential',            label: 'Potential',            bg: '#e0e7ff',                  fg: '#4338ca',                  dot: '#6366f1' },
  { key: 'in_target_list',       label: 'In Target List',       bg: '#fef3c7',                  fg: '#a16207',                  dot: '#eab308' },
  { key: 'new_opportunity',      label: 'New Opportunity',      bg: 'var(--status-info-bg)',    fg: 'var(--status-info-fg)',    dot: 'var(--status-info)' },
  { key: 'ready_to_start',       label: 'READY TO START',       bg: 'var(--status-success-bg)', fg: 'var(--status-success-fg)', dot: 'var(--status-success)' },
  { key: 'modification_request', label: 'MODIFICATION REQUEST', bg: 'var(--status-warning-bg)', fg: 'var(--status-warning-fg)', dot: 'var(--status-warning)' },
  { key: 'working_on_it_trust',  label: 'Working on it Trust',  bg: '#ede9fe',                  fg: '#6d28d9',                  dot: '#7c3aed' },
  { key: 'design_proposal_sent', label: 'Design Proposal SENT', bg: '#fee2e2',                  fg: '#b91c1c',                  dot: '#dc2626' },
  { key: 'waiting_from_op',      label: 'Waiting from OP',      bg: '#ffedd5',                  fg: '#c2410c',                  dot: '#ea580c' },
  { key: 'contract_stage',       label: 'Contract Stage',       bg: '#fef3c7',                  fg: '#a16207',                  dot: '#ca8a04' },
  { key: 'waiting',              label: 'WAITING',              bg: '#ffedd5',                  fg: '#c2410c',                  dot: '#ea580c' },
  { key: 'deal_closed',          label: 'DEAL CLOSED',          bg: 'var(--status-success-bg)', fg: 'var(--status-success-fg)', dot: 'var(--status-success)' },
  { key: 'deal_missed',          label: 'DEAL MISSED',          bg: 'var(--status-danger-bg)',  fg: 'var(--status-danger-fg)',  dot: 'var(--status-danger)' },
];

export const STATUS_META: Record<OpportunityStatus, StatusMeta> =
  Object.fromEntries(STATUS_ORDER.map(s => [s.key, s])) as Record<OpportunityStatus, StatusMeta>;

export const STATUS_OP_OPTIONS: [OpportunityStatus, string][] = [
  ['potential', 'Potential'],
  ['ready_to_start', 'READY TO START'],
  ['modification_request', 'MODIFICATION REQUEST'],
  ['working_on_it_trust', 'WORKING ON IT TRUST'],
  ['design_proposal_sent', 'Design Proposal SENT'],
  ['waiting', 'WAITING'],
  ['in_target_list', 'In Target List'],
  ['deal_missed', 'DEAL MISSED'],
  ['deal_closed', 'DEAL CLOSED'],
];

export const LEAD_INTAKE_STATUS_KEYS: OpportunityStatus[] = [
  'new_opportunity', 'ready_to_start', 'modification_request', 'working_on_it_trust',
  'design_proposal_sent', 'waiting_from_op', 'contract_stage',
];

export const PRIORITY_COLOR: Record<Priority, string> = {
  high:   'var(--status-danger)',
  medium: 'var(--status-warning)',
  low:    'var(--fg-faint)',
};
