import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface RequestUser {
  userId: string;
  role: string | null;
}

export async function resolveRequestUser(req: NextRequest): Promise<RequestUser | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  let userId: string | null = null;
  if (token) {
    const { data: { user } } = await admin.auth.getUser(token);
    userId = user?.id ?? null;
  }
  if (!userId) {
    const { createClient } = await import('@/lib/supabase/server');
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    userId = user?.id ?? null;
  }
  if (!userId) return null;

  const { data } = await admin.from('profiles').select('role').eq('id', userId).single();
  return { userId, role: (data as { role?: string } | null)?.role ?? null };
}

export const OPS_ROLES = ['ops_manager', 'general_manager'] as const;

export function isOpsRole(role: string | null | undefined): boolean {
  return !!role && (OPS_ROLES as readonly string[]).includes(role);
}
