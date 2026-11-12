import { pageAllowed, type PermMap } from '@/lib/permissions/catalog';

// What a role may see and do on Operations → Production Board (Roles page → "Production Board").
// Each switch follows "Production board" (viewing) or "Change production board / statuses"
// (editing) until a role sets it (catalog PAGE_PARENT), so existing roles keep what they had.

export const PROD_KEYS = {
  tabProjects: 'prod.tab_projects',
  tabMissingExtra: 'prod.tab_missing_extra',
  tabDirectOrders: 'prod.tab_direct_orders',
  viewMoney: 'prod.view_money',
  export: 'prod.export',
  editStatus: 'prod.edit_status',
  editRows: 'prod.edit_rows',
  deleteRows: 'prod.delete_rows',
  editProjects: 'prod.edit_projects',
  deleteProjects: 'prod.delete_projects',
  todo: 'prod.todo',
  groups: 'prod.groups',
  half: 'prod.half',
} as const;

export type ProductionAccess = Record<keyof typeof PROD_KEYS, boolean>;

export function productionAccess(role: string | null | undefined, perms: PermMap | null | undefined): ProductionAccess {
  const page = pageAllowed(role, perms, 'page.production');
  return Object.fromEntries(Object.entries(PROD_KEYS).map(([k, key]) => [k, page && pageAllowed(role, perms, key)])) as ProductionAccess;
}

/** Row fields each switch covers (PATCH /api/production/items/:id). */
export const STATUS_FIELDS = new Set(['status', 'pf_sign_status', 'po_sign_status']);
