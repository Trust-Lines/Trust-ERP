import { effectivePermissions, permCan, type PermMap } from './catalog';

const _cache = new Map<string, { perms: PermMap; at: number }>();
const _TTL = 30_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getRolePermissions(admin: any, roleName: string | null | undefined): Promise<PermMap> {
  if (!roleName) return {};
  const hit = _cache.get(roleName);
  if (hit && Date.now() - hit.at < _TTL) return hit.perms;
  const { data } = await admin.from('role_definitions').select('permissions').eq('name', roleName).maybeSingle() as {
    data: { permissions: PermMap | null } | null;
  };
  const perms = effectivePermissions(roleName, data?.permissions ?? null);
  _cache.set(roleName, { perms, at: Date.now() });
  return perms;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function roleCan(admin: any, roleName: string | null | undefined, key: string): Promise<boolean> {
  return permCan(await getRolePermissions(admin, roleName), key);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function userCan(admin: any, userId: string | null | undefined, key: string): Promise<boolean> {
  if (!userId) return false;
  const { data } = await admin.from('profiles').select('role').eq('id', userId).single() as { data: { role: string } | null };
  return roleCan(admin, data?.role ?? null, key);
}
