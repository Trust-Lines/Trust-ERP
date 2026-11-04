import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { SALES_INTAKE_ROLES } from '@/lib/sales/roles';
import { peekFreeProjectNumber } from '@/lib/projects/number';

export async function GET() {
  const { admin, deny } = await requireRole(SALES_INTAKE_ROLES);
  if (deny) return deny;

  // The next FREE number — used ones (Trust, ClickUp, ours) are skipped (lib/projects/number).
  try { return NextResponse.json({ nextNumber: await peekFreeProjectNumber(admin) }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not read the next number' }, { status: 503 }); }
}
