import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_MANAGE_ROLES } from '@/lib/marketing/roles';
import { createUploadAuth } from '@/lib/web-cms/imagekit';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { deny } = await requireRole(MARKETING_MANAGE_ROLES);
  if (deny) return deny;
  const auth = createUploadAuth();
  if (!auth) return NextResponse.json({ error: 'ImageKit keys are not configured on the server' }, { status: 503 });
  return NextResponse.json(auth);
}
