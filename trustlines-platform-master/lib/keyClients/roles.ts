// Plain constants (imported by the permission catalog, which also runs in the browser).

/** Who sees the TLines dashboard data — the default of the page.tlines_dashboard permission. */
export const TLINES_DASHBOARD_ROLES = [
  'general_manager', 'ops_manager', 'sales_marketing_manager', 'project_manager', 'production_manager',
  'supply_manager', 'trustlines_pm', 'design_lead',
];
/** Who maintains the key client list. */
export const KEY_CLIENT_ADMIN_ROLES = ['general_manager', 'ops_manager', 'sales_marketing_manager'];
