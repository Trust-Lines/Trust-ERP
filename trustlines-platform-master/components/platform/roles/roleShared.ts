import type { CSSProperties } from 'react';

export interface RoleDefinition {
  name:        string;
  label:       string;
  description: string | null;
  color_bg:    string;
  color_fg:    string;
  is_system:   boolean;
  permissions: Record<string, boolean>;
}

/** Roles the UI never offers to delete. */
export const PROTECTED_ROLES = ['ops_manager'];

export const HEADING = 'text-[var(--color-secondary-700)] dark:text-[var(--color-secondary-50)]';

// A role's stored pair is tint + strong colour. Dark mode swaps them, like the status tones in globals.css.
export function roleVars(role: Pick<RoleDefinition, 'color_bg' | 'color_fg'>) {
  return { '--role-tint': role.color_bg, '--role-strong': role.color_fg } as CSSProperties;
}
export const ROLE_SURFACE = 'bg-[var(--role-tint)] dark:bg-[var(--role-strong)]';
export const ROLE_TEXT = 'text-[var(--role-strong)] dark:text-[var(--role-tint)]';
