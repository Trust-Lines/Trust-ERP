
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

// Arrival dates can't be before departure. Dates are 'YYYY-MM-DD', so string
// comparison is chronological. Returns an error message, or null when valid.
export function containerDateError(d: {
  departure_date?: unknown; estimated_arrival_date?: unknown; actual_arrival_date?: unknown;
}): string | null {
  const day = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 10) : null);
  const dep = day(d.departure_date);
  if (!dep) return null;
  const eta = day(d.estimated_arrival_date);
  if (eta && eta < dep) return 'Estimated arrival cannot be before the departure date';
  const ata = day(d.actual_arrival_date);
  if (ata && ata < dep) return 'Actual arrival cannot be before the departure date';
  return null;
}
