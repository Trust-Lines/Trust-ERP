import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRolePermissions } from '@/lib/permissions/server';
import { pageAllowed } from '@/lib/permissions/catalog';
import { KEY_CLIENT_ADMIN_ROLES } from './roles';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * API guard for the TLines dashboard data: the page.tlines_dashboard switch (Roles & Permissions).
 * `canManage` = may edit the key client list.
 */
export async function requireTlinesDashboard(): Promise<
  | { user: User; role: string; admin: any; canManage: boolean; deny: null }
  | { user: null; role: null; admin: null; canManage: false; deny: NextResponse }
> {
  const { user, unauth } = await requireUser();
  if (!user) return { user: null, role: null, admin: null, canManage: false, deny: unauth as NextResponse };
  const admin = createAdminClient() as any;
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const role = (data as { role?: string } | null)?.role ?? null;
  const perms = await getRolePermissions(admin, role);
  if (!role || !pageAllowed(role, perms, 'page.tlines_dashboard')) {
    return { user: null, role: null, admin: null, canManage: false, deny: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user, role, admin, canManage: perms.all === true || KEY_CLIENT_ADMIN_ROLES.includes(role), deny: null };
}
