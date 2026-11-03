import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_ROLES } from '@/lib/marketing/roles';
import { SALES_HANDOFF_ROLES } from '@/lib/sales/roles';
import { assertPotentialAccess } from '@/lib/marketing/potentialAccess';
import { ConvertError, convertPotentialToOpportunity } from '@/lib/marketing/convertPotential';

type Params = { params: Promise<{ id: string }> };

// Marketing → "Convert to Opportunity" (lib/marketing/convertPotential): the Potential becomes an
// Opportunity handed to Sales. Same people who may edit the Potential.
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole([...SALES_HANDOFF_ROLES, ...MARKETING_ROLES]);
  if (deny) return deny;
  const denied = await assertPotentialAccess(admin, id, user.id, role);
  if (denied) return denied;
  try {
    return NextResponse.json(await convertPotentialToOpportunity(admin, id, user.id));
  } catch (e) {
    if (e instanceof ConvertError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
