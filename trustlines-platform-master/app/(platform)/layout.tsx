import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AppShell } from '@/components/platform/shell/AppShell';
import { getRolePermissions } from '@/lib/permissions/server';
import { regionLogoByCode, shellLogo, MAIN_CREATIVITY_LOGO, DEFAULT_LOGO } from '@/lib/regionLogo';
import { Toaster } from 'sonner';
import type { UserRole } from '@/types/database';
import { getViewAs, VIEW_AS_ALLOWED } from '@/lib/viewAs';

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('full_name, email, role')
    .eq('id', user.id)
    .single();

  const profile = profileData as { full_name: string; email: string; role: UserRole } | null;

  const userName = profile?.full_name ?? user.email ?? 'User';
  const userEmail = profile?.email ?? user.email ?? '';
  const userRole = profile?.role ?? 'ops_manager';
  // Unread badge on the top-bar bell: head-only count (no rows transferred), scoped to the user by
  // the "own_notifications" RLS policy and the explicit user_id filter. Runs alongside the perms load.
  const [userPerms, unreadRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getRolePermissions(createAdminClient() as any, userRole),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false),
  ]);
  const notificationCount = unreadRes.count ?? 0;
  // General Manager "view as role": userRole above is already the previewed one (lib/viewAs.ts).
  const viewAs = await getViewAs();
  const viewAsState = { canViewAs: !!viewAs || VIEW_AS_ALLOWED.includes(userRole), viewAs: viewAs?.role ?? null };

  let logoSrc = DEFAULT_LOGO;
  if (userRole === 'sales_marketing_manager') {
    logoSrc = MAIN_CREATIVITY_LOGO;
  } else {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adm = createAdminClient() as any;
      const { data: p } = await adm.from('profiles').select('sales_region_id, pm_client_id').eq('id', user.id).single();
      const regionClientId = p?.sales_region_id ?? p?.pm_client_id ?? null;
      if (regionClientId) {
        const { data: c } = await adm.from('clients').select('code').eq('id', regionClientId).single();
        logoSrc = regionLogoByCode(c?.code);
      }
    } catch { }
  }

  return (
    <>
      <AppShell
        userRole={userRole}
        userPerms={userPerms}
        userName={userName}
        userEmail={userEmail}
        logoSrc={shellLogo(logoSrc)}
        notificationCount={notificationCount}
        viewAs={viewAsState}
      >
        {children}
      </AppShell>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { fontFamily: 'var(--font-ui)', fontSize: '13px' },
        }}
      />
    </>
  );
}
