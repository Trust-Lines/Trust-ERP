import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRolePermissions } from '@/lib/permissions/server';
import { pageAllowed } from '@/lib/permissions/catalog';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Who may change the installation plan (everyone with the page can read it). */
export const INSTALL_EDIT_ROLES = ['general_manager', 'ops_manager', 'tlines_pm', 'trustlines_pm'];

export const canEditInstallations = (role: string | null, perms: Record<string, boolean>) =>
  perms.all === true || (!!role && INSTALL_EDIT_ROLES.includes(role));

/** API guard for /api/installations: the page.installation switch, plus whether this person may edit. */
export async function requireInstallations(): Promise<
  | { user: User; admin: any; canEdit: boolean; deny: null }
  | { user: null; admin: null; canEdit: false; deny: NextResponse }
> {
  const { user, unauth } = await requireUser();
  if (!user) return { user: null, admin: null, canEdit: false, deny: unauth as NextResponse };
  const admin = createAdminClient() as any;
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const role = (data as { role?: string } | null)?.role ?? null;
  const perms = await getRolePermissions(admin, role);
  if (!role || !pageAllowed(role, perms, 'page.installation')) {
    return { user: null, admin: null, canEdit: false, deny: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user, admin, canEdit: canEditInstallations(role, perms), deny: null };
}

/** Postgres "table missing" → the migration hasn't been run yet. */
export const tableMissing = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /install/.test(e.message ?? '') && /does not exist|schema cache/.test(e.message ?? ''));

export function failed(error: { code?: string; message: string }) {
  if (tableMissing(error)) return NextResponse.json({ error: 'The installation plan isn’t set up yet (migration 142)' }, { status: 503 });
  console.error('[installations]', error.message);
  return NextResponse.json({ error: 'Could not save the installation plan' }, { status: 500 });
}
