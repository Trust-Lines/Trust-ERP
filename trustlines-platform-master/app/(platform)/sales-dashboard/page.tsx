import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SalesDashboard } from '@/components/platform/sales/SalesDashboard';
import { STATUS_ORDER } from '@/components/platform/leads/types';
import type { Lead } from '@/components/platform/leads/types';
import { regionLabel } from '@/lib/regions';
import { loadOpportunityLeadRows } from '@/lib/marketing/opportunityRows';
import { loadPotentialLeadRows } from '@/lib/marketing/potentialRows';

const DASH_ROLES = ['sales_marketing_manager', 'ops_manager', 'general_manager'];

export default async function SalesDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role ?? '';
  if (!DASH_ROLES.includes(role)) redirect('/dashboard');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = createAdminClient() as any;

  // The pipeline lives in THREE tables now (see PROJECT-MASTER-PLAN.md Phase 00 / the unified CRM
  // board at /leads): the legacy `lead_intake` rows, plus Marketing's `opportunities` and
  // `prospect_potentials`. Reading only `lead_intake` (as this page used to) silently drops every
  // Marketing-sourced deal from the numbers. Mirror the exact merge app/(platform)/leads/page.tsx
  // already does, so the CRM board and this dashboard can never disagree about pipeline size.
  const { data: rows } = await adm
    .from('lead_intake')
    .select('id, assignee_id, deal_size, is_delivered, follow_up_date, opportunity_status, region, created_at')
    .limit(2000);
  const leadIntakeRows = ((rows ?? []) as Record<string, unknown>[]).filter(r => !r.deleted_at && !r.is_archived);
  const leadIntakeDelivered = leadIntakeRows.filter(r => r.is_delivered).length;

  const assigneeIds = [...new Set(leadIntakeRows.map(l => l.assignee_id).filter(Boolean))] as string[];
  const { data: people } = assigneeIds.length
    ? await adm.from('profiles').select('id, full_name').in('id', assigneeIds)
    : { data: [] };
  const nameById = new Map(((people ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]));

  const [opportunityLeads, potentialLeads, deliveredOppsRes] = await Promise.all([
    loadOpportunityLeadRows(supabase as any),
    loadPotentialLeadRows(supabase as any),
    adm.from('opportunities').select('id', { count: 'exact', head: true }).not('project_id', 'is', null),
  ]);
  // An Opportunity is "delivered to Trust" the same way a lead_intake row is: it has a real,
  // already-created project behind it (set only by Sales's Accept action — see lib/marketing/
  // salesHandoff.ts). Potentials never carry a project_id (they are pre-Opportunity), so they never
  // count toward "delivered".
  const opportunityDelivered = (deliveredOppsRes?.count as number | null) ?? 0;

  const leadIntakeAsLeads: Lead[] = leadIntakeRows.map(r => ({
    id: r.id as string,
    name: '', industry: '', brand: '', state: '', priority: 'medium', design_status: '', request: '',
    project_type: '', location: '', date_created: (r.created_at as string) ?? '', source: 'lead_intake',
    contact: '', to_do: '', assignee: nameById.get(r.assignee_id as string) ?? 'Unassigned',
    assignee_id: (r.assignee_id as string) ?? null,
    opportunity_status: (r.opportunity_status as Lead['opportunity_status']) ?? 'new_opportunity',
    deal_size: r.deal_size != null ? Number(r.deal_size) : null,
    follow_up_date: (r.follow_up_date as string) ?? null,
    region: (r.region as string) ?? null,
    origin: 'lead_intake',
  }));

  const allLeads: Lead[] = [...leadIntakeAsLeads, ...opportunityLeads, ...potentialLeads];

  const today = new Date().toISOString().slice(0, 10);
  const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);

  const totalLeads = allLeads.length;
  const pipelineValue = allLeads.reduce((s, l) => s + num(l.deal_size), 0);
  const delivered = leadIntakeDelivered + opportunityDelivered;
  const overdue = allLeads.filter(l => l.follow_up_date && l.follow_up_date < today).length;
  const conversionPct = totalLeads ? Math.round((delivered / totalLeads) * 100) : 0;

  const byStatus = STATUS_ORDER.map(s => {
    const rows = allLeads.filter(l => (l.opportunity_status ?? 'new_opportunity') === s.key);
    return { key: s.key, label: s.label, color: s.dot, count: rows.length, value: rows.reduce((a, l) => a + num(l.deal_size), 0) };
  });

  const asgMap = new Map<string, { name: string; count: number; value: number }>();
  for (const l of allLeads) {
    const key = l.assignee_id || '__none__';
    const name = key === '__none__' ? 'Unassigned' : (l.assignee || 'Unknown');
    const cur = asgMap.get(key) ?? { name, count: 0, value: 0 };
    cur.count += 1; cur.value += num(l.deal_size);
    asgMap.set(key, cur);
  }
  const byAssignee = [...asgMap.values()].sort((a, b) => b.count - a.count).slice(0, 8);

  const regMap = new Map<string, { label: string; count: number; value: number }>();
  for (const l of allLeads) {
    const key = l.region || '__none__';
    const label = key === '__none__' ? 'No region' : regionLabel(key);
    const cur = regMap.get(key) ?? { label, count: 0, value: 0 };
    cur.count += 1; cur.value += num(l.deal_size);
    regMap.set(key, cur);
  }
  const byRegion = [...regMap.values()].sort((a, b) => b.value - a.value);

  return (
    <div className="w-full">
      <SalesDashboard
        kpis={{ totalLeads, pipelineValue, delivered, conversionPct, overdue }}
        byStatus={byStatus}
        byAssignee={byAssignee}
        byRegion={byRegion}
      />
    </div>
  );
}
