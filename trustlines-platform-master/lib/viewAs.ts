import { cache } from 'react';
import { cookies } from 'next/headers';
import { getVerifiedUser } from '@/lib/supabase/server';
import { createRawAdminClient } from '@/lib/supabase/admin';

/**
 * "View as role" (2026-11-06): a General Manager can preview the app as any other role while
 * developing. Pages, the sidebar, page guards and APIs all read the signed-in user's role from
 * `profiles.role`; while this is on, that read returns the chosen role instead (see
 * withViewAs in lib/supabase/admin.ts and lib/supabase/server.ts). Nothing in the database
 * changes, the user id stays the GM's own, and only a real GM can turn it on — the check below
 * always reads the REAL role, never the overridden one.
 *
 * Not covered: database RLS policies still see the real role, so a page that relies only on
 * RLS (rare here — most use the admin client plus app checks) may show a GM more rows than the
 * real role would.
 */

export const VIEW_AS_COOKIE = 'tl_view_as';
export const VIEW_AS_ALLOWED = ['general_manager'];

export const VIEW_AS_ROLES = [
  'ops_manager', 'pm_millwork', 'pm_ceiling', 'trustlines_pm', 'tlines_pm', 'qc_responsible',
  'logistics', 'accounting', 'production_manager', 'project_manager', 'general_manager',
  'accountant', 'sales_marketing_manager', 'sales_rep', 'designer', 'design_lead', 'shop_drawer',
  'supply_manager', 'supply_user', 'production_user', 'warehouse_manager', 'warehouse_user',
  'marketing_pr', 'marketing_manager',
];

/** The signed-in user's role straight from the database — never overridden. */
export const realRoleOf = cache(async (userId: string): Promise<string | null> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (createRawAdminClient() as any).from('profiles').select('role').eq('id', userId).maybeSingle();
  return (data as { role?: string } | null)?.role ?? null;
});

export interface ViewAs { userId: string; realRole: string; role: string }

/** The active preview for this request, or null. Never throws (null outside a request). */
export const getViewAs = cache(async (): Promise<ViewAs | null> => {
  let wanted: string | undefined;
  try { wanted = (await cookies()).get(VIEW_AS_COOKIE)?.value; } catch { return null; }
  if (!wanted || !VIEW_AS_ROLES.includes(wanted)) return null;
  const user = await getVerifiedUser();
  if (!user) return null;
  const realRole = await realRoleOf(user.id);
  if (!realRole || !VIEW_AS_ALLOWED.includes(realRole) || realRole === wanted) return null;
  return { userId: user.id, realRole, role: wanted };
});

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Wrap a Supabase client so every `from('profiles').select(...)` that returns the signed-in
 * user's own row reports the previewed role. Other tables and other people's rows are untouched.
 */
export function withViewAs<T>(client: T): T {
  const c = client as any;
  const from = c.from.bind(c);
  c.from = (table: string) => {
    const qb = from(table);
    if (table !== 'profiles') return qb;
    const select = qb.select.bind(qb);
    qb.select = (...args: unknown[]) => {
      const fb = select(...args);
      const ids = new Set<unknown>();
      const eq = fb.eq.bind(fb);
      fb.eq = (col: string, val: unknown) => { if (col === 'id') ids.add(val); eq(col, val); return fb; };
      const then = fb.then.bind(fb);
      fb.then = (onOk?: (v: any) => any, onErr?: (e: any) => any) => then(async (res: any) => {
        const out = await applyViewAs(res, ids);
        return onOk ? onOk(out) : out;
      }, onErr);
      return fb;
    };
    return qb;
  };
  return client;
}

async function applyViewAs(res: any, ids: Set<unknown>): Promise<any> {
  if (!res?.data) return res;
  const va = await getViewAs();
  if (!va) return res;
  const fix = (row: any) =>
    row && typeof row === 'object' && 'role' in row && (row.id === va.userId || (row.id === undefined && ids.has(va.userId)))
      ? { ...row, role: va.role } : row;
  return { ...res, data: Array.isArray(res.data) ? res.data.map(fix) : fix(res.data) };
}
