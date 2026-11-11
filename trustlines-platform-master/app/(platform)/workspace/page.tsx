import { redirect } from 'next/navigation';
import { requirePage } from '@/lib/permissions/requirePage';
import { getVerifiedUser } from '@/lib/supabase/server';
import { WorkspaceHeading } from '@/components/platform/myWorkspace/WorkspaceHeading';
import { WorkspaceOverview } from '@/components/platform/myWorkspace/WorkspaceOverview';

// My Workspace → Overview: the person's own work across departments (WorkspaceOverview).
export default async function WorkspaceOverviewPage() {
  await requirePage('page.my_workspace');
  const user = await getVerifiedUser();
  if (!user) redirect('/login');
  return (
    <div className="flex flex-col gap-[30px]">
      <WorkspaceHeading title="My Workspace" href="/workspace" subtitle="Your tasks, approvals, meetings and updates — from every department, in one place." />
      <WorkspaceOverview userId={user.id} />
    </div>
  );
}
