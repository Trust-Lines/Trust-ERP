import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';

// A tlines_pm sees only the projects they are the T-Lines PM of — unless an admin ticked
// "Sees every T-Lines project" on them (profiles.sees_all_projects, migration 156; the RLS
// policies there follow the same flag). PF / cost / margin stay hidden by role either way.

/** profiles.sees_all_projects — the "coordinator" switch (Team → Edit). Any role; false if unset. */
export const seesAllProjects = cache(async (userId: string): Promise<boolean> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data, error } = await admin.from('profiles').select('sees_all_projects').eq('id', userId).maybeSingle();
  // Column missing (156 not applied) or lookup failed → the narrow rule.
  if (error) return false;
  return !!(data as { sees_all_projects?: boolean } | null)?.sees_all_projects;
});

/** True when this person may only see projects where they are the T-Lines PM. */
export async function ownProjectsOnly(role: string | null | undefined, userId: string): Promise<boolean> {
  if (role !== 'tlines_pm') return false;
  return !(await seesAllProjects(userId));
}
