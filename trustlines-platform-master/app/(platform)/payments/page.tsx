import { redirect } from 'next/navigation';
import { requirePage } from '@/lib/permissions/requirePage';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRolePermissions } from '@/lib/permissions/server';
import { pageAllowed } from '@/lib/permissions/catalog';
import { NO_PF_ROLES } from '@/lib/production/access';
import { ProductionClient } from '@/components/platform/production/ProductionClient';
import type { ProductionAccess } from '@/lib/production/access';

export const dynamic = 'force-dynamic';

// Finance / Payments: the accounting sheet (Figma 935:22284) — the Production Board's rows, read
// only on the board side, with the Accounting / Payments / Invoice & Receipt cards to the right.
// The board API sends the payment columns only to roles with page.payments; typing into them needs
// "Edit payments" too (checked again by /api/payments/items/:id).
const PAYMENTS_ACCESS: ProductionAccess = {
  tabProjects: true, tabMissingExtra: true, tabDirectOrders: true, viewMoney: true, viewPf: true,
  export: false, editStatus: false, editRows: false, deleteRows: false, editProjects: false, deleteProjects: false,
  todo: false, groups: false, half: false,
};

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
  return <ProductionClient access={PAYMENTS_ACCESS} mode="payments" canEditPayments={canEdit} />;
}
