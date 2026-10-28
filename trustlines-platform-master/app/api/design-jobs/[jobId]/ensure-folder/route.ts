import { NextRequest, NextResponse } from 'next/server';
import { requireUserWithRole, loadDesignJobWithAccess } from '@/lib/sales/design';
import { resolveDesignFolder } from '@/lib/sales/designFolder';

// Opens/creates the job's Dropbox design folder — the Project's design folder, or a Pre-Project
// one when the deal has no Project yet (lib/sales/designFolder.ts).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { user, role, admin, deny } = await requireUserWithRole();
  if (deny) return deny;
  const { job, deny: accessDeny } = await loadDesignJobWithAccess(admin, jobId, user.id, role);
  if (accessDeny) return accessDeny;

  const folder = await resolveDesignFolder(admin, job!, { create: true });
  if (!folder.ok) return NextResponse.json({ error: folder.error }, { status: folder.status });
  return NextResponse.json({ designRoot: folder.root, created: folder.created, alreadyExists: !folder.created });
}
