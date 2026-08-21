import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_READ_ROLES } from '@/lib/marketing/roles';
import { findProspectDuplicates } from '@/lib/marketing/duplicates';

export async function GET(req: NextRequest) {
  const { admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;

  const url = new URL(req.url);
  const duplicates = await findProspectDuplicates(admin, {
    organizationName: url.searchParams.get('org'),
    personName: url.searchParams.get('person'),
    website: url.searchParams.get('website'),
    email: url.searchParams.get('email'),
    phone: url.searchParams.get('phone'),
  }, url.searchParams.get('excludeId') ?? undefined);

  return NextResponse.json({ duplicates });
}
