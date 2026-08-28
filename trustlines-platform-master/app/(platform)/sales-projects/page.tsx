import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { SalesOpportunitiesClient, type SalesOpportunityRow } from '@/components/platform/sales/SalesOpportunitiesClient';

const SALES_VISIBLE_STAGES = [
  'sales_handoff', 'sales_accepted', 'discovery', 'sales_design', 'proposal',
  'negotiation', 'closed_won', 'closed_lost',
];

export default async function SalesProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role ?? '';
  if (!SALES_HANDOFF_ROLES.includes(role)) redirect('/dashboard');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const res = await admin.from('opportunities')
    .select('id, prospect_id, need_id, title, project_types, scope_types, stage, deadline, '
      + 'sales_owner_id, sales_handoff_at, sales_accepted_at, project_id, return_reason, closed_reason, created_at, updated_at')
    .is('deleted_at', null)
    .or(`stage.in.(${SALES_VISIBLE_STAGES.join(',')}),sales_owner_id.eq.${user.id}`)
    .order('sales_handoff_at', { ascending: true, nullsFirst: false }).limit(500);
  const base = (res.error ? [] : (res.data ?? [])) as Omit<SalesOpportunityRow, 'lead_display_name' | 'owner_name'>[];

  const prospectIds = [...new Set(base.map(o => o.prospect_id))];
  let leadById: Record<string, string> = {};
  let nameById: Record<string, string> = {};
  if (prospectIds.length) {
    const { data: leads } = await admin.from('prospects').select('id, display_name').in('id', prospectIds);
    leadById = Object.fromEntries(((leads ?? []) as { id: string; display_name: string }[]).map(l => [l.id, l.display_name]));
    const ownerIds = [...new Set(base.map(o => o.sales_owner_id).filter(Boolean))] as string[];
    if (ownerIds.length) {
      const { data: people } = await admin.from('profiles').select('id, full_name').in('id', ownerIds);
      nameById = Object.fromEntries(((people ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]));
    }
  }

  // Roadmap Month 2, task 18 — a stage-level mini summary instead of just an "Open Design Job →"
  // link: Sales could not tell whether a design job is actually moving without leaving this page.
  const oppIds = base.map(o => o.id);
  const designJobByOpp: Record<string, { status: string; designerName: string | null; updatedAt: string }> = {};
  if (oppIds.length) {
    const { data: jobs } = await admin.from('sales_design_jobs')
      .select('opportunity_id, status, assigned_designer_id, updated_at').in('opportunity_id', oppIds).is('deleted_at', null);
    const designerIds = [...new Set(((jobs ?? []) as { assigned_designer_id: string | null }[]).map(j => j.assigned_designer_id).filter(Boolean))] as string[];
    let designerNameById: Record<string, string> = {};
    if (designerIds.length) {
      const { data: designers } = await admin.from('profiles').select('id, full_name').in('id', designerIds);
      designerNameById = Object.fromEntries(((designers ?? []) as { id: string; full_name: string }[]).map(d => [d.id, d.full_name]));
    }
    for (const j of (jobs ?? []) as { opportunity_id: string | null; status: string; assigned_designer_id: string | null; updated_at: string }[]) {
      if (j.opportunity_id) {
        designJobByOpp[j.opportunity_id] = {
          status: j.status, designerName: j.assigned_designer_id ? (designerNameById[j.assigned_designer_id] ?? null) : null, updatedAt: j.updated_at,
        };
      }
    }
  }

  const opportunities: SalesOpportunityRow[] = base.map(o => ({
    ...o,
    lead_display_name: leadById[o.prospect_id] ?? '—',
    owner_name: nameById[o.sales_owner_id ?? ''] ?? null,
    design_job: designJobByOpp[o.id] ?? null,
  }));

  return (
    <div className="main-inner">
      <SalesOpportunitiesClient initialOpportunities={opportunities} currentUserId={user.id} loadError={!!res.error} />
    </div>
  );
}
