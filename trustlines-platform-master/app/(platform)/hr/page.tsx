import { requirePage } from '@/lib/permissions/requirePage';
import { HrDashboardClient } from '@/components/platform/hr/HrDashboardClient';

// Figma "TRUST-LINES-ERP" → "HR board" (node 585:3113). Same access as the Team page — HR is
// the people side of Admin until it has a permission of its own.
export default async function HrDashboardPage() {
  await requirePage('page.team');
  return <HrDashboardClient />;
}
