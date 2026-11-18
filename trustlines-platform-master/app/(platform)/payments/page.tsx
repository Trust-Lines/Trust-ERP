import { redirect } from 'next/navigation';
import { requirePage } from '@/lib/permissions/requirePage';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRolePermissions } from '@/lib/permissions/server';
import { pageAllowed } from '@/lib/permissions/catalog';
import { NO_PF_ROLES, productionAccess } from '@/lib/production/access';
import { ProductionClient } from '@/components/platform/production/ProductionClient';
import type { ProductionAccess } from '@/lib/production/access';

export const dynamic = 'force-dynamic';

// Finance / Payments: the accounting sheet (Figma 935:22284) — the Production Board's rows with
// the Accounting / Payments / Invoice & Receipt cards to the right. The Project card is edited with
// the role's own Production Board switches (statuses, rows, projects, half — the same API checks
// them again); the payment cards need "Edit payments" (checked again by /api/payments/items/:id).
// All three tabs and the money columns are shown here; PF never to tlines_pm.
function paymentsAccess(role: string | null, perms: Parameters<typeof productionAccess>[1]): ProductionAccess {
  const prod = productionAccess(role, perms);
  return {
    ...prod,
    tabProjects: true, tabMissingExtra: true, tabDirectOrders: true, viewMoney: true,
    viewPf: !NO_PF_ROLES.has(role ?? ''),
    export: false, todo: false, groups: false,
  };
}

export default async function PaymentsPage() {
  await requirePage('page.payments');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role: string } | null)?.role ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perms = await getRolePermissions(createAdminClient() as any, role);
  const canEdit = !!role && !NO_PF_ROLES.has(role) && pageAllowed(role, perms, 'edit.payments');
  return <ProductionClient access={paymentsAccess(role, perms)} mode="payments" canEditPayments={canEdit} />;
}
