import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function requireRole(
  allowed: string[],
  denyMessage = 'Forbidden',
): Promise<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { user: User; role: string; admin: any; deny: null }
  | { user: null; role: null; admin: null; deny: ReturnType<typeof NextResponse.json> }
> {
  const { user, unauth } = await requireUser();
  if (!user) return { user: null, role: null, admin: null, deny: unauth };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const role = (data as { role?: string } | null)?.role ?? null;

  if (!role || !allowed.includes(role)) {
    return { user: null, role: null, admin: null, deny: NextResponse.json({ error: denyMessage }, { status: 403 }) };
  }
  return { user, role, admin, deny: null };
}
