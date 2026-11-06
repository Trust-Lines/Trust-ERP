import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { withViewAs } from '@/lib/viewAs';

/** Service-role client with no "view as role" override — for checks that need the real role. */
export function createRawAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Service-role client. A General Manager previewing another role sees that role on their own profile row. */
export function createAdminClient() {
  return withViewAs(createRawAdminClient());
}
