import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRolePermissions } from '@/lib/permissions/server';
import { pageAllowed } from '@/lib/permissions/catalog';
import { SALES_INTAKE_ROLES } from '@/lib/sales/roles';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Who may edit / delete anyone's library entries (others may edit only their own). */
const LIBRARY_MANAGER_ROLES = ['design_lead', ...SALES_INTAKE_ROLES];

/**
 * API guard for the Design library pages: the same page switch the page itself checks
 * (Roles & Permissions; follows page.design until set separately).
 */
export async function requireDesignPage(key: string): Promise<
  | { user: User; role: string; admin: any; isManager: boolean; deny: null }
  | { user: null; role: null; admin: null; isManager: false; deny: NextResponse }
> {
  const { user, unauth } = await requireUser();
  if (!user) return { user: null, role: null, admin: null, isManager: false, deny: unauth as NextResponse };
  const admin = createAdminClient() as any;
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const role = (data as { role?: string } | null)?.role ?? null;
  const perms = await getRolePermissions(admin, role);
  if (!role || !pageAllowed(role, perms, key)) {
    return { user: null, role: null, admin: null, isManager: false, deny: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user, role, admin, isManager: perms.all === true || LIBRARY_MANAGER_ROLES.includes(role), deny: null };
}

/** Owner or manager — the rule for editing and deleting a library entry. */
export function canEditEntry(entry: { created_by: string | null }, userId: string, isManager: boolean): boolean {
  return isManager || entry.created_by === userId;
}

/** Postgres "relation does not exist" — migration 133 not applied yet. */
export function tableMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  return !!error && (error.code === '42P01' || /does not exist|schema cache/i.test(error.message ?? ''));
}

export const NOT_READY = 'The design library tables are not ready — run migration 133_design_library.sql.';
