import { redirect } from 'next/navigation';

// 2026-11-09: the branch board moved to /tlines-pm (sidebar "T-Lines PM"). /dashboard is still
// where login, "/" and every "not allowed here" redirect land, so until the new per-section
// dashboards exist it forwards there (keeping ?view=trust for the GM's Trust Lines board).
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  redirect(view === 'trust' ? '/tlines-pm?view=trust' : '/tlines-pm');
}
