import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect as nextRedirect } from 'next/navigation';
import { ModuleGrid, type ModuleBadge } from '@/components/platform/dashboard/ModuleGrid';
import { getRolePermissions } from '@/lib/permissions/server';
import type { UserRole } from '@/types/database';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) nextRedirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const today = new Date().toISOString().split('T')[0];

  const { data: profileData } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  const profile = profileData as { full_name: string | null; role: string | null } | null;
  const userRole = (profile?.role ?? 'ops_manager') as UserRole;
  const userName = profile?.full_name ?? user.email ?? 'User';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userPerms = await getRolePermissions(admin as any, userRole);

  // Fetch quick live stats for badges
  const { data: allProjects } = await admin
    .from('projects')
    .select('id, current_stage, est_delivery_date')
    .is('deleted_at', null)
    .neq('is_archived', true) as { data: {
      id: string; current_stage: string; est_delivery_date: string | null;
    }[] | null };

  const projects = allProjects ?? [];
  const active = projects.filter(p => p.current_stage !== 'delivered');
  const activeCount = active.length;
  const inProduction = active.filter(p => p.current_stage === 'production').length;
  const overdueCount = active.filter(p => p.est_delivery_date && p.est_delivery_date < today).length;

  const isAdmin = ['ops_manager', 'general_manager'].includes(userRole);
  let approvalsQuery = admin
    .from('document_approvals')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (!isAdmin) {
    approvalsQuery = approvalsQuery.eq('assigned_to', user.id);
  }

  const { count: pendingApprovalsCount } = await approvalsQuery;

  // ── Badge counts for module grid ────────────────────────────────────────
  const badges: Record<string, ModuleBadge> = {};

  if (activeCount > 0) {
    badges['projects'] = { value: `${activeCount} active`, tone: 'success' };
  }
  if (pendingApprovalsCount && pendingApprovalsCount > 0) {
    badges['approvals'] = {
      value: `${pendingApprovalsCount} pending`,
      tone: pendingApprovalsCount > 3 ? 'danger' : 'warning',
    };
  }
  if (overdueCount > 0) {
    badges['pm'] = { value: `${overdueCount} overdue`, tone: 'danger' };
  }
  if (inProduction > 0) {
    badges['production'] = { value: `${inProduction} in progress`, tone: 'info' };
  }

  return (
    <div className="w-full">
      <ModuleGrid
        userName={userName}
        userRole={userRole}
        userPerms={userPerms}
        badges={badges}
      />
    </div>
  );
}
