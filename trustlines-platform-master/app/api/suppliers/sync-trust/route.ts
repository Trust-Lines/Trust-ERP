import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { SUPPLIER_WRITE_ROLES } from '@/lib/suppliers/config';
import { syncSuppliersFromTrust } from '@/lib/suppliers/trustSync';

export const dynamic = 'force-dynamic';

// Suppliers → "Update from Trust": the Trust System's Production vendors (lib/suppliers/trustSync).
// Body { removeMissing?: boolean } — also takes out suppliers Trust doesn't have (deleted when
// nothing points at them, else set inactive).
export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireRole([...SUPPLIER_WRITE_ROLES]);
  if (deny) return deny;
  const body = await req.json().catch(() => ({})) as { removeMissing?: boolean };
  try {
    const report = await syncSuppliersFromTrust(admin, { removeMissing: body.removeMissing === true });
    await logAudit({ actorId: user.id, action: 'suppliers.synced_from_trust', resource: 'suppliers', newValue: { ...report } });
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not read the Trust System' }, { status: 502 });
  }
}
