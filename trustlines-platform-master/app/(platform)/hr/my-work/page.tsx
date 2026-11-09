import { requirePage } from '@/lib/permissions/requirePage';
import { MyDayCard } from '@/components/platform/dashboard/MyDayCard';
import { HrPageHeader } from '@/components/platform/hr/HrPages';

// "My work" in the HR group: the same personal task feed as /my-tasks (GET /api/my-day).
export default async function HrMyWorkPage() {
  await requirePage('page.team');
  return (
    <div className="flex flex-col gap-6">
      <HrPageHeader title="My work" href="/hr/my-work" subtitle="Everything waiting on you right now." />
      <MyDayCard full />
    </div>
  );
}
