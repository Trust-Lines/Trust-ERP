import { requirePage } from '@/lib/permissions/requirePage';
import { getVerifiedUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRolePermissions } from '@/lib/permissions/server';
import { canEditInstallations, tableMissing } from '@/lib/installations/access';
import { projectNumber } from '@/lib/keyClients/match';
import { InstallationClient } from '@/components/platform/installation/InstallationClient';
import type { InstallTeam, Installation } from '@/lib/installations/compute';
import { milestonesFrom, type MilestoneItem, type ProjectMilestones } from '@/lib/installations/lifecycle';
import { fetchInChunks } from '@/lib/supabase/chunkedIn';

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
    admin.from('projects').select('id, code, closed_deal_date').is('deleted_at', null),
    admin.from('install_teams').select('*').order('sort_order', { ascending: true }).order('name'),
  ]);

  // "#480 STG 1" → the project whose code carries 480, to open it from the register.
  const projectByNo: Record<string, string> = {};
  const closedById = new Map<string, string | null>();
  for (const p of (projects ?? []) as { id: string; code: string | null; closed_deal_date: string | null }[]) {
    const no = projectNumber(p.code);
    if (no && !projectByNo[no]) projectByNo[no] = p.id;
    closedById.set(p.id, p.closed_deal_date);
  }

  // Gantt (Figma 784:18261): real stage dates for the projects on the plan only — production
  // milestones (production_items) and when the opportunity was opened. Read-only, bounded by the
  // plan's rows; dates only (no PF codes, vendors or money). Missing data just draws fewer stages.
  const milestonesByNo: Record<string, ProjectMilestones> = {};
  const planNos = [...new Set(((rows ?? []) as Installation[]).map(r => projectNumber(r.project_no)).filter((n): n is string => !!n))];
  const planIds = [...new Set(planNos.map(n => projectByNo[n]).filter(Boolean))];
  if (planIds.length) {
    try {
      const [items, opps] = await Promise.all([
        fetchInChunks(planIds, chunk => admin.from('production_items')
          .select('project_id, std, rtr, rtd, rdy, ftd, snd, container_date')
          .eq('source', 'project').is('deleted_at', null).in('project_id', chunk)),
        fetchInChunks(planIds, chunk => admin.from('opportunities')
          .select('project_id, created_at').is('deleted_at', null).in('project_id', chunk)),
      ]) as [(MilestoneItem & { project_id: string })[], { project_id: string; created_at: string }[]];
      for (const no of planNos) {
        const id = projectByNo[no];
        if (!id) continue;
        milestonesByNo[no] = milestonesFrom(
          items.filter(i => i.project_id === id),
          opps.filter(o => o.project_id === id).map(o => o.created_at),
          closedById.get(id) ?? null,
        );
      }
    } catch (e) {
      console.error('[installation] stage dates unavailable:', e instanceof Error ? e.message : e);
    }
  }

  return (
    <InstallationClient
      initialRows={(rows ?? []) as Installation[]}
      initialTeams={(teams ?? []) as InstallTeam[]}
      teamsSetupNeeded={!!teamsError}
      setupNeeded={tableMissing(error)}
      loadError={error && !tableMissing(error) ? 'The installation plan could not be loaded.' : null}
      canEdit={canEditInstallations(role, perms)}
      projectByNo={projectByNo}
      milestonesByNo={milestonesByNo}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
