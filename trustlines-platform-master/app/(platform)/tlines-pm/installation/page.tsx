import { requirePage } from '@/lib/permissions/requirePage';
import { getVerifiedUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRolePermissions } from '@/lib/permissions/server';
import { canEditInstallations, tableMissing } from '@/lib/installations/access';
import { InstallationClient } from '@/components/platform/installation/InstallationClient';
import type { InstallTeam, Installation } from '@/lib/installations/compute';
import { projectIdByNumber } from '@/lib/installations/ganttData';

export const dynamic = 'force-dynamic';

// T-Lines PM → Installation: the "INSTALLATION PROJECT PLAN" workbook, in the app (migration 142).
// The register is the only thing people edit; the dashboard, months, Gantt and team allocation
// are calculated from it (lib/installations/compute.ts).
export default async function InstallationPage() {
  await requirePage('page.installation');
  const user = await getVerifiedUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: me } = await admin.from('profiles').select('role').eq('id', user!.id).single();
  const role = (me as { role?: string } | null)?.role ?? null;
  const perms = await getRolePermissions(admin, role);

  const [{ data: rows, error }, { data: projects }, { data: teams, error: teamsError }] = await Promise.all([
    admin.from('installations').select('*').order('sort_order', { ascending: true }),
    admin.from('projects').select('id, code').is('deleted_at', null),
    admin.from('install_teams').select('*').order('sort_order', { ascending: true }).order('name'),
  ]);

  // "#480 STG 1" → the project whose code carries 480, to open it from the register / Gantt.
  // (The lifecycle Gantt with every stage now lives on /dashboard → "View as Gantt chart".)
  const today = new Date().toISOString().slice(0, 10);
  const projectByNo = projectIdByNumber(projects ?? []);

  return (
    <InstallationClient
      initialRows={(rows ?? []) as Installation[]}
      initialTeams={(teams ?? []) as InstallTeam[]}
      teamsSetupNeeded={!!teamsError}
      setupNeeded={tableMissing(error)}
      loadError={error && !tableMissing(error) ? 'The installation plan could not be loaded.' : null}
      canEdit={canEditInstallations(role, perms)}
      projectByNo={projectByNo}
      today={today}
    />
  );
}
