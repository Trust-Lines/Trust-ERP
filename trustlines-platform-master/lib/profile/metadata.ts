
import type { UserRole } from '@/types/database';

export const COMPANY_SIDES = ['trust_lines', 't_lines'] as const;
export type CompanySide = (typeof COMPANY_SIDES)[number];

export const OFFICES = ['turkey', 'syria', 'usa', 'other'] as const;
export type Office = (typeof OFFICES)[number];

export const DEPARTMENTS = [
  'sales', 'marketing', 'design', 'pm', 'supply', 'production',
  'qc', 'warehouse', 'logistics', 'accounting', 'management',
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const SKILLS = [
  'millwork', 'shelving', 'ceiling', 'image',
  'graphic', 'shop_drawing', 'furniture', 'decoration',
] as const;
export type Skill = (typeof SKILLS)[number];

export const COMPANY_SIDE_LABELS: Record<CompanySide, string> = {
  trust_lines: 'Trust Lines',
  t_lines: 'T-Lines',
};

export const OFFICE_LABELS: Record<Office, string> = {
  turkey: 'Turkey',
  syria: 'Syria',
  usa: 'USA',
  other: 'Other',
};

export const DEPARTMENT_LABELS: Record<Department, string> = {
  sales: 'Sales',
  marketing: 'Marketing',
  design: 'Design',
  pm: 'Project Management',
  supply: 'Supply',
  production: 'Production',
  qc: 'QC',
  warehouse: 'Warehouse',
  logistics: 'Logistics',
  accounting: 'Accounting',
  management: 'Management',
};

export const SKILL_LABELS: Record<Skill, string> = {
  millwork: 'Millwork',
  shelving: 'Shelving',
  ceiling: 'Ceiling',
  image: 'Image',
  graphic: 'Graphic',
  shop_drawing: 'Shop Drawing',
  furniture: 'Furniture',
  decoration: 'Decoration',
};

export const isCompanySide = (v: unknown): v is CompanySide => COMPANY_SIDES.includes(v as CompanySide);
export const isOffice      = (v: unknown): v is Office      => OFFICES.includes(v as Office);
export const isDepartment  = (v: unknown): v is Department  => DEPARTMENTS.includes(v as Department);
export const isSkill       = (v: unknown): v is Skill       => SKILLS.includes(v as Skill);

export function officeLabel(office: string | null | undefined): string | null {
  if (!office) return null;
  return isOffice(office) ? OFFICE_LABELS[office] : office;
}

export function normalizeSkills(input: unknown): Skill[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter(isSkill))];
}

const T_LINES_ROLES: readonly string[] = ['tlines_pm', 'sales_rep', 'sales_marketing_manager', 'marketing_pr', 'marketing_manager'];

export function defaultCompanySideForRole(role: UserRole | string | null | undefined): CompanySide | null {
  if (!role) return null;
  return T_LINES_ROLES.includes(role) ? 't_lines' : 'trust_lines';
}

const ROLE_DEPARTMENTS: Record<string, Department> = {
  ops_manager: 'management',
  general_manager: 'management',
  sales_rep: 'sales',
  sales_marketing_manager: 'sales',
  marketing_pr: 'marketing',
  marketing_manager: 'marketing',
  designer: 'design',
  design_lead: 'design',
  shop_drawer: 'design',
  tlines_pm: 'pm',
  trustlines_pm: 'pm',
  project_manager: 'pm',
  supply_manager: 'supply',
  supply_user: 'supply',
  production_manager: 'production',
  production_user: 'production',
  pm_millwork: 'production',
  pm_ceiling: 'production',
  qc_responsible: 'qc',
  warehouse_manager: 'warehouse',
  warehouse_user: 'warehouse',
  logistics: 'logistics',
  accounting: 'accounting',
  accountant: 'accounting',
};

export function defaultDepartmentForRole(role: UserRole | string | null | undefined): Department | null {
  if (!role) return null;
  return ROLE_DEPARTMENTS[role] ?? null;
}
