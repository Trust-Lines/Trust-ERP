import { requirePage } from '@/lib/permissions/requirePage';
import { WorkspaceHeading } from '@/components/platform/myWorkspace/WorkspaceHeading';
import { MyCalendarClient } from '@/components/platform/myWorkspace/MyCalendarClient';

export const dynamic = 'force-dynamic';

// My Workspace → Calendar & Meetings (was T-Lines PM → My meetings; /meetings redirects here).
export default async function MyCalendarPage() {
  await requirePage('page.my_workspace');
  return (
    <div className="flex flex-col gap-6">
      <WorkspaceHeading title="Calendar & Meetings" href="/workspace/calendar" subtitle="Your meetings and task due dates in one month view." />
      <MyCalendarClient />
    </div>
  );
}
