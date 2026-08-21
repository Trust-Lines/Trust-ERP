import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildMyDay } from '@/lib/dashboard/myDay';

export async function GET() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single() as {
    data: { role: string } | null;
  };
  const role = profile?.role ?? null;

  const myDay = await buildMyDay(admin, user.id, role);
  return NextResponse.json(myDay);
}
