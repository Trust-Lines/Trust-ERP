import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MyDayCard } from '@/components/platform/dashboard/MyDayCard';
import { PageCrumbs } from '@/components/platform/shared/PageCrumbs';

// "View All" from the dashboard's My Tasks table: the same /api/my-day feed, with every row.
export default async function MyTasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex flex-col gap-[30px]">
      <div className="flex flex-col gap-[5px] leading-[1.35]">
        <PageCrumbs items={[{ label: 'General', href: '/dashboard' }, { label: 'My Tasks', href: '/my-tasks' }]} />
        <h1 className="m-0 text-[28px] font-semibold leading-[1.35] text-[var(--color-secondary-700)] dark:text-ui-heading">My Tasks</h1>
        <p className="m-0 text-[13px] text-ui-body">Everything waiting on you right now.</p>
      </div>
      <MyDayCard full />
    </div>
  );
}
