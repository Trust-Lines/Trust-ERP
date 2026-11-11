import Link from 'next/link';
import { requirePage } from '@/lib/permissions/requirePage';
import { getVerifiedUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRolePermissions } from '@/lib/permissions/server';
import { pageAllowed } from '@/lib/permissions/catalog';
import { WorkspaceHeading } from '@/components/platform/myWorkspace/WorkspaceHeading';
import { MyApprovalsClient } from '@/components/platform/myWorkspace/MyApprovalsClient';

// My Workspace → My Approvals: what waits on my decision. The Operations → Approvals inbox stays
// where it is; this page reads the same sources (MyApprovalsClient).
export default async function MyApprovalsPage() {
  await requirePage('page.my_workspace');
  const user = await getVerifiedUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: profile } = user ? await admin.from('profiles').select('role').eq('id', user.id).single() : { data: null };
  const role = (profile as { role: string } | null)?.role ?? null;
  const inbox = pageAllowed(role, await getRolePermissions(admin, role), 'page.approvals');

  return (
    <div className="flex flex-col gap-6">
      <WorkspaceHeading
        title="My Approvals" href="/workspace/approvals"
        subtitle="Documents and requests waiting for your decision."
        actions={inbox ? <Link href="/approvals" className="text-[13px] font-medium text-ui-link no-underline hover:underline">Open the Approvals inbox</Link> : undefined}
      />
      <MyApprovalsClient />
    </div>
  );
}
