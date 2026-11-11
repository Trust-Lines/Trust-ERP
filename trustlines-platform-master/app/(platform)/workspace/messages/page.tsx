import { requirePage } from '@/lib/permissions/requirePage';
import { WorkspaceHeading } from '@/components/platform/myWorkspace/WorkspaceHeading';
import { TeamMessages } from '@/components/platform/messages/TeamMessages';

// My Workspace → Messages (was HR → Messages; /hr/messages redirects here).
export default async function MessagesPage() {
  await requirePage('page.my_workspace');
  return (
    <div className="flex flex-col gap-6">
      <WorkspaceHeading title="Messages" href="/workspace/messages" subtitle="Your conversations with the team." />
      <TeamMessages />
    </div>
  );
}
