import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRolePermissions } from '@/lib/permissions/server';
import { pageAllowed, type PermMap } from '@/lib/permissions/catalog';

/**
 * A Production Board write. `keys` are the Roles page switches the action needs (all of them);
 * default edit.production. The prod.* switches follow edit.production until a role sets them,
 * (the project page's Types tab uses the same row routes, so the page itself is not required).
 */
export async function requireProductionWrite(keys: string | string[] = 'edit.production'): Promise<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { user: User; role: string; perms: PermMap; admin: any; deny: null }
  | { user: null; role: null; perms: null; admin: null; deny: ReturnType<typeof NextResponse.json> }
> {
  const { user, unauth } = await requireUser();
  if (!user) return { user: null, role: null, perms: null, admin: null, deny: unauth };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const role = (data as { role?: string } | null)?.role ?? null;
  const perms = await getRolePermissions(admin, role);

  const need = Array.isArray(keys) ? keys : [keys];
  const ok = !!role && need.every(k => pageAllowed(role, perms, k));
  if (!ok) {
    return { user: null, role: null, perms: null, admin: null, deny: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user, role: role!, perms, admin, deny: null };
}
