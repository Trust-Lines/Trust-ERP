import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePage } from '@/lib/permissions/requirePage';
import { MARKETING_MANAGE_ROLES, MARKETING_READ_ROLES, MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { isMonth, monthGridRange } from '@/lib/marketing/prWorkspace';
import { loadCalendarRange, loadCampaignOptions, PrWorkspaceNotReady } from '@/lib/marketing/prWorkspaceServer';
import { MarketingCalendarClient } from '@/components/platform/marketing/pr/MarketingCalendarClient';
import type { UserRole } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function MarketingCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requirePage('page.marketing_calendar');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const userRole = (profileData as { role: UserRole } | null)?.role ?? 'marketing_pr';
  if (!MARKETING_READ_ROLES.includes(userRole)) redirect('/marketing');

  const { month: monthParam } = await searchParams;
  const month = isMonth(monthParam) ? monthParam : new Date().toISOString().slice(0, 7);
  const { from, to } = monthGridRange(month);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  let initial: ({ from: string; to: string } & Awaited<ReturnType<typeof loadCalendarRange>>) | null = null;
  let campaigns: Awaited<ReturnType<typeof loadCampaignOptions>> = [];
  let loadError: string | null = null;
  try {
    const [range, options] = await Promise.all([loadCalendarRange(admin, from, to), loadCampaignOptions(admin)]);
    initial = { from, to, ...range };
    campaigns = options;
  } catch (e) {
    loadError = e instanceof PrWorkspaceNotReady
      ? 'The calendar table isn’t set up yet — migration 127 needs to be applied.'
      : 'The calendar could not be loaded. Please refresh the page.';
  }

  return (
    <div className="main-inner">
      <MarketingCalendarClient
        initialMonth={month} initial={initial} campaigns={campaigns} loadError={loadError}
        canEdit={MARKETING_WRITE_ROLES.includes(userRole)} isManager={MARKETING_MANAGE_ROLES.includes(userRole)} userId={user.id}
      />
    </div>
  );
}
