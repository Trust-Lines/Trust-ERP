export type Action =
  | 'project:create'
  | 'project:update'
  | 'project:delete'
  | 'project:view_financials'
  | 'project:view_margin'
  | 'document:upload'
  | 'document:approve'
  | 'document:view_pf'
  | 'document:sign_pf'
  | 'stage:advance'
  | 'stage:override'
  | 'qc:manage'
  | 'supplier:view'
  | 'team:manage'
  | 'audit:view'
  | 'notes:view_internal';

const PERMISSIONS: Record<Action, string[]> = {
  'project:create':          ['ops_manager'],
  'project:update':          ['ops_manager', 'general_manager'],
  'project:delete':          ['ops_manager', 'general_manager'],
  'project:view_financials': ['ops_manager', 'general_manager', 'accounting'],
  'project:view_margin':     ['ops_manager', 'general_manager'],
  'document:upload':         ['ops_manager', 'general_manager', 'pm_millwork', 'pm_ceiling', 'pm_image', 'trustlines_pm', 'qc_responsible', 'logistics'],
  'document:approve':        ['ops_manager', 'general_manager', 'trustlines_pm', 'tlines_pm'],
  'document:view_pf':        ['ops_manager', 'general_manager', 'pm_millwork', 'pm_ceiling', 'pm_image', 'trustlines_pm', 'accounting'],
  'document:sign_pf':        ['general_manager'],
  'stage:advance':           ['ops_manager', 'general_manager', 'trustlines_pm'],
  'stage:override':          ['ops_manager'],
  'qc:manage':               ['ops_manager', 'general_manager', 'qc_responsible'],
  'supplier:view':           ['ops_manager', 'general_manager', 'pm_millwork', 'pm_ceiling', 'pm_image', 'trustlines_pm', 'accounting'],
  'team:manage':             ['ops_manager'],
  'audit:view':              ['ops_manager', 'general_manager'],
  'notes:view_internal':     ['ops_manager', 'general_manager', 'pm_millwork', 'pm_ceiling', 'pm_image', 'trustlines_pm', 'qc_responsible', 'logistics', 'accounting'],
};

export function can(role: string, action: Action): boolean {
  return PERMISSIONS[action]?.includes(role) ?? false;
}

export function canAny(role: string, actions: Action[]): boolean {
  return actions.some(a => can(role, a));
}
