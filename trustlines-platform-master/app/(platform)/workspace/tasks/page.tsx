import { requirePage } from '@/lib/permissions/requirePage';
import { WorkspaceHeading } from '@/components/platform/myWorkspace/WorkspaceHeading';
import { MyTasksClient } from '@/components/platform/myWorkspace/MyTasksClient';
import { MyDayCard } from '@/components/platform/dashboard/MyDayCard';

// My Workspace → My Tasks (was /my-tasks and HR → My work; both redirect here).
//   Assigned to me   — task rows assigned to the person (Sales / Marketing tasks, follow-ups).
//   Waiting on you   — the role's work queue (signatures, QC, items on hold, …): the same
//                      /api/my-day feed My Tasks and HR My work showed before.
export default async function MyTasksPage() {
  await requirePage('page.my_workspace');
  return (
    <div className="flex flex-col gap-[30px]">
      <WorkspaceHeading title="My Tasks" href="/workspace/tasks" subtitle="Tasks assigned to you, and everything else waiting on you right now." />
      <MyTasksClient />
      <section aria-label="Waiting on you" className="flex flex-col gap-4">
        <h2 className="m-0 text-[18px] font-semibold text-[var(--color-secondary-700)] dark:text-ui-heading">Waiting on you</h2>
        <MyDayCard full />
      </section>
    </div>
  );
}
