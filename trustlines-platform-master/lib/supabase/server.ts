import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { Database } from '@/types/database';
import type { User } from '@supabase/supabase-js';

export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

export async function requireUser(): Promise<
  { user: User; unauth: null } | { user: null; unauth: ReturnType<typeof NextResponse.json> }
> {
  const user = await getSessionUser();
  if (!user) return { user: null, unauth: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { user, unauth: null };
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
          }
        },
      },
    },
  );
}
