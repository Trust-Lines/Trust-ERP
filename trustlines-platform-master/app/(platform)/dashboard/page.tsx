import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GeneralManagerDashboard, type GmKpi, type GmTask } from '@/components/platform/dashboard/GeneralManagerDashboard';

// General Manager dashboard (Figma "General Manager", node 778:11311). Only general_manager
// gets this page; everyone else keeps the redirect to the branch board (fail closed on any
// missing or unknown role). Counts come from existing tables; no new endpoint or migration.

const DATE_FMT: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
const TIME_FMT: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };

function greetingFor(now: Date): string {
  const h = now.getHours();
  if (h < 12) return 'Good Morning';
  if (h < 18) return 'Good Afternoon';
  return 'Good Evening';
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const fallback = view === 'trust' ? '/tlines-pm?view=trust' : '/tlines-pm';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profileData } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single();
  const profile = profileData as { full_name: string | null; role: string | null } | null;
  if (profile?.role !== 'general_manager') redirect(fallback);

  const admin = createAdminClient() as any;
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [activeRes, newRes, dealsRes, approvalsRes] = await Promise.all([
    admin.from('projects').select('id', { count: 'exact', head: true }).is('deleted_at', null).neq('is_archived', true),
    admin.from('projects').select('id', { count: 'exact', head: true }).is('deleted_at', null).neq('is_archived', true).gte('created_at', weekAgo),
    admin.from('projects').select('id', { count: 'exact', head: true }).is('deleted_at', null).not('closed_deal_date', 'is', null),
    admin.from('document_approvals')
      .select('id, stage, doc_type, created_at, project_id', { count: 'exact' })
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(6),
  ]);

  const approvalRows: { id: string; stage: number; doc_type: string; created_at: string; project_id: string }[] = approvalsRes.data ?? [];
  const projectIds = [...new Set(approvalRows.map(a => a.project_id))];
  const codeById = new Map<string, string>();
  if (projectIds.length > 0) {
    const { data: projectRows } = await admin.from('projects').select('id, code').in('id', projectIds);
    for (const p of (projectRows ?? []) as { id: string; code: string }[]) codeById.set(p.id, p.code);
  }

  const now = new Date();
  const kpis: GmKpi[] = [
    { key: 'active', label: 'Active Projects', value: String(activeRes.count ?? 0), sub: 'Open projects', href: '/projects', tone: 'navy', icon: 'briefcase', badge: (newRes.count ?? 0) > 0 ? `+${newRes.count} New` : undefined },
    { key: 'approvals', label: 'Pending Approvals', value: String(approvalsRes.count ?? 0), sub: 'Waiting for a decision', href: '/approvals', tone: 'purple', icon: 'user' },
    { key: 'deals', label: 'Deals Closed', value: String(dealsRes.count ?? 0), sub: 'Projects with a closed deal date', href: '/projects', tone: 'green', icon: 'check' },
  ];

  const tasks: GmTask[] = approvalRows.map(a => ({
    id: a.id,
    title: `${codeById.get(a.project_id) ?? 'Project'} · ${a.doc_type}`,
    statusLabel: `Stage ${a.stage}`,
    createdLabel: new Date(a.created_at).toLocaleString('en-GB', TIME_FMT),
    href: '/approvals',
  }));

  return (
    <GeneralManagerDashboard
      fullName={profile.full_name ?? ''}
      roleLabel="General Manager"
      weekdayLabel={now.toLocaleDateString('en-GB', { weekday: 'long' })}
      dateLabel={now.toLocaleDateString('en-GB', DATE_FMT)}
      greeting={greetingFor(now)}
      breadcrumbs="General / Dashboard"
      kpis={kpis}
      tasks={tasks}
      taskTotal={approvalsRes.count ?? 0}
    />
  );
}
