import { PieChart } from 'lucide-react';
import { requirePage } from '@/lib/permissions/requirePage';
import { EmptyState } from '@/components/ui/empty-state';

// Finance placeholder (Figma "All Pages" → Finance). Same gate as Expenses until Budgets gets its
// own permission and data.
export default async function BudgetsPage() {
  await requirePage('page.budgets');
  return (
    <div className="main-inner">
      <h1 style={{ fontSize: 'var(--fs-h1)', fontWeight: 700, margin: 0 }}>Budgets</h1>
      <EmptyState icon={<PieChart />} title="Coming soon" description="This page is not built yet." />
    </div>
  );
}
