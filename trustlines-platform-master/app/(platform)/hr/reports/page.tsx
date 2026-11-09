import { requirePage } from '@/lib/permissions/requirePage';
import { HrReportsPage } from '@/components/platform/hr/HrPages';

export default async function Page() {
  await requirePage('page.team');
  return <HrReportsPage />;
}
