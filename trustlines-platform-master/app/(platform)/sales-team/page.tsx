import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SalesTeamClient, type SalesRepRow, type RegionClient } from '@/components/platform/team/SalesTeamClient';
import { SALES_TEAM_ADMIN_ROLES } from '@/lib/sales/roles';
import { fetchInChunks } from '@/lib/supabase/chunkedIn';

export default async function SalesTeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role ?? '';
  if (!SALES_TEAM_ADMIN_ROLES.includes(role)) redirect('/dashboard');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = createAdminClient() as any;

  const [repsRes, clientsRes, peekRes] = await Promise.all([
    adm.from('profiles')
      .select('id, full_name, email, is_active, sales_region_id, created_at')
      .eq('role', 'sales_rep')
      .order('full_name'),
    adm.from('clients')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name'),
    adm.rpc('peek_global_number'),
  ]);

  const baseReps = (repsRes.data ?? []) as Omit<SalesRepRow, 'project_count'>[];
  const regionClients = (clientsRes.data ?? []) as RegionClient[];
  const nextNumber = (peekRes.data as number) ?? 1;

  // "Assigned to" = distinct projects a rep owns: Opportunities where they're the Sales owner plus
  // CRM leads assigned to them, counted once per project_id.
  const repIds = baseReps.map(r => r.id);
  const projectsByRep = new Map<string, Set<string>>();
  // A count is a nice-to-have: if it can't load, the page still shows (counts read 0).
  if (repIds.length) try {
    const [oppRows, leadRows] = await Promise.all([
      fetchInChunks(repIds, chunk => adm.from('opportunities').select('sales_owner_id, project_id')
        .in('sales_owner_id', chunk).not('project_id', 'is', null).is('deleted_at', null)),
      fetchInChunks(repIds, chunk => adm.from('lead_intake').select('assignee_id, project_id')
        .in('assignee_id', chunk).not('project_id', 'is', null).is('deleted_at', null)),
    ]);
    const add = (repId: string | null, projectId: string | null) => {
      if (!repId || !projectId) return;
      const set = projectsByRep.get(repId) ?? new Set<string>();
      set.add(projectId);
      projectsByRep.set(repId, set);
    };
    for (const o of oppRows as { sales_owner_id: string | null; project_id: string | null }[]) add(o.sales_owner_id, o.project_id);
    for (const l of leadRows as { assignee_id: string | null; project_id: string | null }[]) add(l.assignee_id, l.project_id);
  } catch (e) {
    console.error('[sales-team] project counts failed', e);
  }
  const reps: SalesRepRow[] = baseReps.map(r => ({ ...r, project_count: projectsByRep.get(r.id)?.size ?? 0 }));

  return (
    <div style={{ padding: 28 }}>
      <SalesTeamClient reps={reps} regionClients={regionClients} nextNumber={nextNumber} />
    </div>
  );
}
