import { requirePage } from '@/lib/permissions/requirePage';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { QcWorkspaceClient } from '@/components/platform/qc/QcWorkspaceClient';
import { loadQcQueue, QC_WRITE_ROLES } from '@/lib/qc/load';
import type { UserRole } from '@/types/database';

export default async function QcPage() {
  await requirePage('page.qc');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: me } = await admin.from('profiles').select('role').eq('id', user!.id).maybeSingle();
  const userRole = (me?.role ?? null) as UserRole | null;
  const canInspect = !!userRole && QC_WRITE_ROLES.includes(userRole);

  const { queue, names, projects, migrationReady } = await loadQcQueue(admin, user!.id);

  return (
    <QcWorkspaceClient
      queue={queue}
      names={names}
      projects={projects}
      canInspect={canInspect}
      migrationReady={migrationReady}
    />
  );
}
