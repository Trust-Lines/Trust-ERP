// profiles.role → Turkish label (roles: trustlines-platform-master/lib/viewAs.ts VIEW_AS_ROLES).
const ROLE_TR: Record<string, string> = {
  general_manager: 'Genel Müdür', ops_manager: 'Operasyon Müdürü', production_manager: 'Üretim Müdürü',
  production_user: 'Üretim', project_manager: 'Proje Müdürü', trustlines_pm: 'Trust Lines PM', tlines_pm: 'T-Lines PM',
  pm_millwork: 'PM · Millwork', pm_ceiling: 'PM · Ceiling', qc_responsible: 'QC Sorumlusu', logistics: 'Lojistik',
  accounting: 'Muhasebe', accountant: 'Muhasebe', supply_manager: 'Tedarik Müdürü', supply_user: 'Tedarik',
  warehouse_manager: 'Depo Müdürü', warehouse_user: 'Depo', sales_marketing_manager: 'Satış & Pazarlama Müdürü',
  sales_rep: 'Satış', designer: 'Tasarımcı', design_lead: 'Tasarım Lideri', shop_drawer: 'Shop Drawing',
  marketing_pr: 'Pazarlama · PR', marketing_manager: 'Pazarlama Müdürü',
};
export const roleLabel = (role: string | null | undefined) => (role ? ROLE_TR[role] ?? role : '');
