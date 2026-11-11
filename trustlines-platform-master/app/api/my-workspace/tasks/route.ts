import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRolePermissions } from '@/lib/permissions/server';
import { pageAllowed } from '@/lib/permissions/catalog';
import { loadMyTasks } from '@/lib/myWorkspace/tasks';

// My Workspace → My Tasks: tasks assigned to the signed-in person across the existing task
// tables (lib/myWorkspace/tasks.ts). The person comes from the session, never from the request.
export async function GET() {
  const { user, unauth } = await requireUser();
  if (!user) return unauth;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single() as { data: { role: string } | null };
  const role = profile?.role ?? '';
  const perms = await getRolePermissions(admin, role);
  if (!pageAllowed(role, perms, 'page.my_workspace')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    return NextResponse.json({ tasks: await loadMyTasks(admin, user.id, role, perms) });
  } catch (e) {
    console.error('[my-workspace/tasks]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Could not load your tasks. Refresh to try again.' }, { status: 500 });
  }
}
