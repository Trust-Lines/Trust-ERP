import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_INTAKE_ROLES } from '@/lib/sales/roles';
import { syncSalesTasks } from '@/lib/sales/syncTasks';

// Brings the Sales task list up to date with the pipeline (see lib/sales/syncTasks.ts).
// Idempotent — the Tasks page calls it on load, and it can be hit any time.
export async function POST(req: NextRequest) {
  const { admin, deny } = await requireRole(SALES_INTAKE_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => ({})) as { opportunityId?: string };
  try {
    const result = await syncSalesTasks(admin, { opportunityId: typeof body.opportunityId === 'string' ? body.opportunityId : undefined });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Sync failed' }, { status: 500 });
  }
}
