import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect as nextRedirect } from 'next/navigation';
import DashboardClient, {
  type DashboardStats,
  type ApprovalItem,
  type ActivityItem,
  type DashboardProjectItem,
} from '@/components/platform/dashboard/DashboardClient';
import { getRolePermissions } from '@/lib/permissions/server';

const STAGE_LABELS: Record<string, string> = {
  closed_deal:    'Finalization',
  finalization:   'Finalization',
  client_approval:'Construction Documents',
  production:     'Production',
  delivered:      'Delivery',
};

const STAGE_COLORS: Record<string, string> = {
  closed_deal:    '#6366f1',
  finalization:   '#6366f1',
  client_approval:'#0ea5e9',
  production:     '#10b981',
  delivered:      '#6b7280',
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) nextRedirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const today      = new Date().toISOString().split('T')[0];
  const weekAgo    = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const twoWeeksAgo= new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
  const dayAgo     = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { data: profileData } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single();
  const profile   = profileData as { full_name: string | null; role: string | null } | null;
  const userRole  = profile?.role ?? 'ops_manager';
  const userName  = profile?.full_name ?? user.email ?? 'User';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userPerms = await getRolePermissions(admin as any, userRole);

  const { data: allProjects } = await admin
    .from('projects')
    .select('id, code, name, current_stage, est_delivery_date, margin_target_pct, trustlines_pm_id, created_at')
    .is('deleted_at', null)
    .neq('is_archived', true) as { data: {
      id: string; code: string; name: string; current_stage: string;
      est_delivery_date: string | null; margin_target_pct: number | null;
      trustlines_pm_id: string | null; created_at: string;
    }[] | null };

  const projects = allProjects ?? [];
  const active   = projects.filter(p => p.current_stage !== 'delivered');

  const activeCount    = active.length;
  const inProduction   = active.filter(p => p.current_stage === 'production').length;
  const overdueProjs   = active.filter(p => p.est_delivery_date && p.est_delivery_date < today);
  const overdueCount   = overdueProjs.length;

  const marginsAll  = active.map(p => p.margin_target_pct).filter((m): m is number => m !== null);
  const marginAvg   = marginsAll.length > 0 ? marginsAll.reduce((a, b) => a + b, 0) / marginsAll.length : null;

  const newThisWeek = projects.filter(p => p.created_at >= weekAgo).length;
  const prodLastWeek  = active.filter(p => p.current_stage === 'production' && p.created_at >= weekAgo).length;
  const prod2WeeksAgo = active.filter(p => p.current_stage === 'production' && p.created_at >= twoWeeksAgo && p.created_at < weekAgo).length;
  const prodDelta     = prodLastWeek - prod2WeeksAgo;
  const overdueLastWeek  = active.filter(p => p.est_delivery_date && p.est_delivery_date < today && p.created_at >= weekAgo).length;
  const overdueWeekBefore= active.filter(p => p.est_delivery_date && p.est_delivery_date < today && p.created_at >= twoWeeksAgo && p.created_at < weekAgo).length;
  const overdueDelta     = overdueLastWeek - overdueWeekBefore;

  const stats: DashboardStats = {
    activeProjects: activeCount,
    inProduction,
    overdueCount,
    marginAvg,
    newThisWeek,
    prodDelta,
    overdueDelta,
  };

  const isAdmin = ['ops_manager', 'general_manager'].includes(userRole);
  let approvalsQuery = admin
    .from('document_approvals')
    .select('id, stage, doc_type, version_num, assigned_to, requested_by, created_at, project_id, document_id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(20);

  if (!isAdmin) {
    approvalsQuery = approvalsQuery.eq('assigned_to', user.id);
  }

  const { data: approvalRows } = await approvalsQuery as { data: {
    id: string; stage: number; doc_type: string; version_num: number | null;
    assigned_to: string | null; requested_by: string | null; created_at: string;
    project_id: string; document_id: string;
  }[] | null };

  const apprProfileIds = [...new Set([
    ...(approvalRows ?? []).map(a => a.requested_by),
  ].filter(Boolean))] as string[];

  const [apprProfilesRes, apprProjectsRes] = await Promise.all([
    apprProfileIds.length > 0
      ? admin.from('profiles').select('id, full_name').in('id', apprProfileIds)
      : Promise.resolve({ data: [] }),
    (approvalRows ?? []).length > 0
      ? admin.from('projects').select('id, code, name')
          .in('id', [...new Set((approvalRows ?? []).map(a => a.project_id))])
      : Promise.resolve({ data: [] }),
  ]);

  const apprProfileMap = new Map(
    ((apprProfilesRes.data ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name])
  );
  const apprProjectMap = new Map(
    ((apprProjectsRes.data ?? []) as { id: string; code: string; name: string }[]).map(p => [p.id, p])
  );

  const now = Date.now();
  const approvals: ApprovalItem[] = (approvalRows ?? []).map(a => {
    const proj = apprProjectMap.get(a.project_id);
    return {
      id:            a.id,
      projectId:     a.project_id,
      projectCode:   proj?.code ?? '—',
      projectName:   proj?.name ?? '—',
      docType:       a.doc_type,
      stage:         a.stage,
      versionNum:    a.version_num,
      requesterName: apprProfileMap.get(a.requested_by ?? '') ?? 'Unknown',
      waitingMs:     now - new Date(a.created_at).getTime(),
    };
  });



  const { data: auditRows } = await admin
    .from('audit_log')
    .select('id, action, resource, new_value, created_at, actor_id, project_id')
    .gte('created_at', dayAgo)
    .order('created_at', { ascending: false })
    .limit(20) as { data: {
      id: string; action: string; resource: string | null;
      new_value: unknown; created_at: string; actor_id: string | null; project_id: string | null;
    }[] | null };

  const auditActorIds = [...new Set((auditRows ?? []).map(e => e.actor_id).filter(Boolean))] as string[];
  const auditProjectIds = [...new Set((auditRows ?? []).map(e => e.project_id).filter(Boolean))] as string[];

  const [auditProfilesRes, auditProjectsRes] = await Promise.all([
    auditActorIds.length > 0
      ? admin.from('profiles').select('id, full_name').in('id', auditActorIds)
      : Promise.resolve({ data: [] }),
    auditProjectIds.length > 0
      ? admin.from('projects').select('id, code').in('id', auditProjectIds)
      : Promise.resolve({ data: [] }),
  ]);

  const auditProfileMap = new Map(
    ((auditProfilesRes.data ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name])
  );
  const auditProjectMap = new Map(
    ((auditProjectsRes.data ?? []) as { id: string; code: string }[]).map(p => [p.id, p.code])
  );

  const activity: ActivityItem[] = (auditRows ?? []).map(e => ({
    id:          e.id,
    action:      e.action,
    resource:    e.resource,
    createdAt:   e.created_at,
    actorName:   auditProfileMap.get(e.actor_id ?? '') ?? 'System',
    projectId:   e.project_id,
    projectCode: e.project_id ? (auditProjectMap.get(e.project_id) ?? null) : null,
  }));

  const pmProfileIds = [...new Set(projects.map(p => p.trustlines_pm_id).filter(Boolean))] as string[];
  const { data: pmProfilesData } = pmProfileIds.length > 0
    ? await admin.from('profiles').select('id, full_name').in('id', pmProfileIds)
    : { data: [] };
  const pmProfileMap = new Map(
    ((pmProfilesData ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name])
  );

  const stageWeights: Record<string, number> = {
    closed_deal: 15,
    discovery: 15,
    planning: 35,
    client_approval: 55,
    production: 75,
    execution: 75,
    qc: 90,
    testing: 90,
    finalization: 85,
    delivered: 100,
  };

  const projectsList = active.slice(0, 10).map(p => ({
    id: p.id,
    code: p.code,
    name: p.name,
    stage: p.current_stage,
    stageLabel: STAGE_LABELS[p.current_stage] ?? p.current_stage,
    ownerName: pmProfileMap.get(p.trustlines_pm_id ?? '') ?? userName ?? 'Frontend Demo',
    progress: stageWeights[p.current_stage] ?? 85,
    updatedAt: p.created_at ? p.created_at.split('T')[0] : today,
  }));

  return (
    <DashboardClient
      userName={userName}
      userRole={userRole}
      stats={stats}
      approvals={approvals}
      activity={activity}
      projectsList={projectsList}
      today={today}
    />
  );
}
