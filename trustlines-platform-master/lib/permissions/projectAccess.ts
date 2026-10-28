import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient, requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { roleCan } from './server';

// Mirrors the visibility rules of /projects/[id]/page.tsx so an API route never
// exposes a project the user could not open in the UI:
//   1. the project must be readable through the user's own RLS session, and
//   2. a tlines_pm only sees projects they are assigned to.
// Fails closed: any lookup error counts as "no access".
export async function canAccessProject(projectId: string, userId: string, role: string | null): Promise<boolean> {
  if (!role) return false;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('projects').select('id, tlines_pm_id').eq('id', projectId).maybeSingle() as {
      data: { id: string; tlines_pm_id: string | null } | null;
      error: { message: string } | null;
    };
  if (error || !data) return false;
  if (role === 'tlines_pm' && data.tlines_pm_id !== userId) return false;
  return true;
}

// Auth + permission key + project visibility in one call, for service-role routes.
export async function requireProjectPermission(
  projectId: string,
  permKey: string,
  opts: { denyRoles?: string[] } = {},
): Promise<
  | { user: User; role: string; deny: null }
  | { user: null; role: null; deny: NextResponse }
> {
  const { user, unauth } = await requireUser();
  if (!user) return { user: null, role: null, deny: unauth as NextResponse };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const role = (data as { role?: string } | null)?.role ?? null;
  const forbidden = { user: null, role: null, deny: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  if (!role || opts.denyRoles?.includes(role)) return forbidden;
  if (!(await roleCan(admin, role, permKey))) return forbidden;
  const denied = await assertProjectAccess(projectId, user.id, role);
  if (denied) return { user: null, role: null, deny: denied };
  return { user, role, deny: null };
}

export async function assertProjectAccess(
  projectId: string,
  userId: string,
  role: string | null,
): Promise<NextResponse | null> {
  const ok = await canAccessProject(projectId, userId, role);
  return ok ? null : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
