import type { UserRole } from '@/types/database';

// Row shapes and role labels shared by the Team page and its member modals.

export interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  pm_client_id?: string | null;
  is_pm_supervisor?: boolean;
  company_side?: string | null;
  office?: string | null;
  department?: string | null;
  skills?: string[] | null;
  manager_id?: string | null;
  region_ids?: string[] | null;
  service_line_ids?: string[] | null;
  assigned_regions?: string[] | null;
}

export interface ClientRow {
  id: string;
  name: string;
  code: string | null;
}

export interface ServiceLineRow {
  id: string;
  name: string;
  client_id: string;
}

export interface FranchiseRow {
  id: string;
  name: string;
  code: string | null;
  client_id: string;
  client: ClientRow | null;
}

export interface RoleOption {
  name: string;
  label: string;
  color_bg: string;
  color_fg: string;
  is_system: boolean;
}

export interface Props {
  profiles: ProfileRow[];
  clients: ClientRow[];
  franchises: FranchiseRow[];
  roleDefinitions: RoleOption[];
  serviceLines: ServiceLineRow[];
  metadataReady: boolean;
  userRole: UserRole;
  canEdit?: boolean;
}

export const SALES_ROLES = ['sales_marketing_manager', 'sales_rep'];

export const FALLBACK_LABELS: Partial<Record<string, string>> = {
  ops_manager:    'Ops Manager',
  pm_millwork:    'PM · Millwork',
  pm_ceiling:     'PM · Ceiling',
  trustlines_pm:  'TL Project Manager',
  tlines_pm:      'T-Lines PM',
  qc_responsible: 'QC Responsible',
  logistics:      'Logistics',
  accounting:     'Accounting',
  sales_marketing_manager: 'Sales & Marketing Manager',
  sales_rep:               'Sales Rep',
};
