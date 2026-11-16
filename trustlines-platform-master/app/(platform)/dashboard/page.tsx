import { BranchBoardPage } from '@/components/platform/dashboard/BranchBoardPage';

// Main dashboard — Figma TRUST-LINES ERP → "General Manager" (node 767:13745): heading with the
// date range, greeting + My Tasks, the /tlines-pm board filters, KPI tiles, then the 4-branch
// board. Same data, visibility rules (RLS session, region scope, tlines_pm own projects,
// marketing → /marketing) and filters as /tlines-pm — BranchBoardPage is shared by both.
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  return <BranchBoardPage viewParam={view} layout="dashboard" />;
}
