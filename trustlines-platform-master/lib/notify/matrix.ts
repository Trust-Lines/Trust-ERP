
/* eslint-disable @typescript-eslint/no-explicit-any */

export type ProjectRoleKey = 'tlines_pm_id' | 'trustlines_pm_id';

export interface NotifyRule {
  type: string;
  projectRoles: ProjectRoleKey[];
  roles: string[];
  emailPerm?: string;
}

export const NOTIFY_MATRIX: Record<string, NotifyRule> = {
  'lead.closed_won': {
    type: 'project.closed_won',
    projectRoles: ['tlines_pm_id', 'trustlines_pm_id'],
    roles: [],
  },

  'handover.ready': {
    type: 'handover.ready',
    projectRoles: ['trustlines_pm_id', 'tlines_pm_id'],
    roles: [],
  },

  'site.ready': {
    type: 'site.ready',
    projectRoles: ['trustlines_pm_id', 'tlines_pm_id'],
    roles: ['logistics'],
  },

  'po.vendor_needed': {
    type: 'po.vendor_needed',
    projectRoles: ['trustlines_pm_id'],
    roles: ['production_manager'],
  },
  'po.chain_complete': {
    type: 'po.chain_complete',
    projectRoles: ['trustlines_pm_id'],
    roles: [],
  },

  'project.items_ready': {
    type: 'project.items_ready',
    projectRoles: ['tlines_pm_id', 'trustlines_pm_id'],
    roles: [],
    emailPerm: 'notify.ready',
  },

  'container.arrived': {
    type: 'container.arrived',
    projectRoles: ['tlines_pm_id', 'trustlines_pm_id'],
    roles: [],
  },

  'change_request.approved': {
    type: 'change_request.approved',
    projectRoles: ['trustlines_pm_id'],
    roles: ['production_manager', 'pm_millwork', 'pm_ceiling'],
  },

  'approval.reminder': {
    type: 'approval.reminder',
    projectRoles: [],
    roles: [],
    emailPerm: 'notify.approval_request',
  },
};

export function ruleFor(eventType: string): NotifyRule | null {
  return NOTIFY_MATRIX[eventType] ?? null;
}

export async function audienceFor(
  admin: any,
  rule: NotifyRule,
  project: Record<string, unknown> | null,
  lookupRoles: (admin: any, roles: string[]) => Promise<string[]>,
): Promise<(string | null | undefined)[]> {
  const named = project
    ? rule.projectRoles.map(key => project[key] as string | null | undefined)
    : [];
  const byRole = rule.roles.length ? await lookupRoles(admin, rule.roles) : [];
  return [...named, ...byRole];
}
