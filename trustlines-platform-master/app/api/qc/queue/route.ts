import { NextResponse } from 'next/server';
import { requireApiPage } from '@/lib/permissions/requireApi';
import { loadQcQueue, QC_WRITE_ROLES } from '@/lib/qc/load';

// The QC workspace data the /qc page renders — read by the mobile app (QC queue, 007/008).
export async function GET() {
  const { user, role, admin, deny } = await requireApiPage('page.qc');
  if (deny) return deny;
  const data = await loadQcQueue(admin, user.id);
  return NextResponse.json({ ...data, canInspect: QC_WRITE_ROLES.includes(role) });
}
