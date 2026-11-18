import { requirePage } from '@/lib/permissions/requirePage';
import { ProductionClient } from '@/components/platform/production/ProductionClient';
import type { ProductionAccess } from '@/lib/production/access';

export const dynamic = 'force-dynamic';

// Finance / Payments: the accounting "green table" — the Production Board's design and data,
// read only, with the Accounting / Payments T Lines / Invoice & Receipt tables to the right.
// The board API sends the payment columns only to roles with page.payments.
const PAYMENTS_ACCESS: ProductionAccess = {
  tabProjects: true, tabMissingExtra: true, tabDirectOrders: true, viewMoney: true, viewPf: true,
  export: false, editStatus: false, editRows: false, deleteRows: false, editProjects: false, deleteProjects: false,
  todo: false, groups: false, half: false,
};

export default async function PaymentsPage() {
  await requirePage('page.payments');
  return <ProductionClient access={PAYMENTS_ACCESS} mode="payments" />;
}
