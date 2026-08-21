
export const DELIVERY_READ_ROLES = [
  'ops_manager', 'general_manager', 'trustlines_pm', 'tlines_pm', 'logistics', 'qc_responsible', 'pm_millwork', 'pm_ceiling',
];
export const DELIVERY_WRITE_ROLES = [
  'ops_manager', 'general_manager', 'trustlines_pm', 'tlines_pm', 'logistics',
];
export const PUNCH_WRITE_ROLES = [...DELIVERY_WRITE_ROLES, 'qc_responsible'];

export const DELIVERY_METHODS = ['warehouse', 'direct_job_site', 'partial', 'hold'];
export const DELIVERY_STATUSES = ['planning', 'scheduled', 'in_progress', 'completed'];
export const BUILD_BY = ['trust_build', 'customer', 'other'];
