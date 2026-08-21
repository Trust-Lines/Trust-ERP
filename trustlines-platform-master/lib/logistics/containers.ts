
export const CONTAINER_STATUSES = [
  'PLANNING', 'BOOKED', 'WAITING_LOADING', 'LOADING', 'DEPARTED', 'IN_TRANSIT',
  'ARRIVED_PORT', 'CUSTOMS', 'RELEASED', 'WAREHOUSE', 'COMPLETED', 'CANCELLED',
] as const;

export const CONTAINER_IN_TRANSIT = new Set(['DEPARTED', 'IN_TRANSIT', 'ARRIVED_PORT', 'CUSTOMS', 'RELEASED']);

export const CONTAINER_ARRIVAL_STATUSES = new Set(['ARRIVED_PORT', 'WAREHOUSE']);

export const CONTAINER_READ_ROLES = [
  'ops_manager', 'general_manager', 'trustlines_pm', 'tlines_pm',
  'logistics', 'accounting', 'qc_responsible', 'pm_millwork', 'pm_ceiling',
];
export const CONTAINER_WRITE_ROLES = [
  'ops_manager', 'general_manager', 'trustlines_pm', 'logistics',
];
