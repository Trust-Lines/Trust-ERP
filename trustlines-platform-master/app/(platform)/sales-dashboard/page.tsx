import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SalesDashboard } from '@/components/platform/sales/SalesDashboard';
import { STATUS_ORDER } from '@/components/platform/leads/types';
import { regionLabel } from '@/lib/regions';

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
  const { data: rows } = await adm.from('lead_intake').select('*').limit(2000);
  const leads = ((rows ?? []) as Record<string, unknown>[]).filter(r => !r.deleted_at && !r.is_archived);

  const assigneeIds = [...new Set(leads.map(l => l.assignee_id).filter(Boolean))] as string[];
  const { data: people } = assigneeIds.length
    ? await adm.from('profiles').select('id, full_name').in('id', assigneeIds)
    : { data: [] };
  const nameById = new Map(((people ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]));

  const today = new Date().toISOString().slice(0, 10);
  const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);

  const totalLeads = leads.length;
  const pipelineValue = leads.reduce((s, l) => s + num(l.deal_size), 0);
  const delivered = leads.filter(l => l.is_delivered).length;
  const overdue = leads.filter(l => l.follow_up_date && (l.follow_up_date as string) < today).length;
  const conversionPct = totalLeads ? Math.round((delivered / totalLeads) * 100) : 0;

  const byStatus = STATUS_ORDER.map(s => {
    const rows = leads.filter(l => (l.opportunity_status ?? 'new_opportunity') === s.key);
    return { key: s.key, label: s.label, color: s.dot, count: rows.length, value: rows.reduce((a, l) => a + num(l.deal_size), 0) };
  });

  const asgMap = new Map<string, { name: string; count: number; value: number }>();
  for (const l of leads) {
    const key = (l.assignee_id as string) || '__none__';
    const name = key === '__none__' ? 'Unassigned' : (nameById.get(key) ?? 'Unknown');
    const cur = asgMap.get(key) ?? { name, count: 0, value: 0 };
    cur.count += 1; cur.value += num(l.deal_size);
    asgMap.set(key, cur);
  }
  const byAssignee = [...asgMap.values()].sort((a, b) => b.count - a.count).slice(0, 8);

  const regMap = new Map<string, { label: string; count: number; value: number }>();
  for (const l of leads) {
    const key = (l.region as string) || '__none__';
    const label = key === '__none__' ? 'No region' : regionLabel(key);
    const cur = regMap.get(key) ?? { label, count: 0, value: 0 };
    cur.count += 1; cur.value += num(l.deal_size);
    regMap.set(key, cur);
  }
  const byRegion = [...regMap.values()].sort((a, b) => b.value - a.value);

  return (
    <div className="main-inner">
      <SalesDashboard
        kpis={{ totalLeads, pipelineValue, delivered, conversionPct, overdue }}
        byStatus={byStatus}
        byAssignee={byAssignee}
        byRegion={byRegion}
      />
    </div>
  );
}
