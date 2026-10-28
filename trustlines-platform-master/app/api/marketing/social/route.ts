import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_READ_ROLES } from '@/lib/marketing/roles';
import { loadSocialData, PrWorkspaceNotReady } from '@/lib/marketing/prWorkspaceServer';

// Accounts + follower history + posts, in one call — the Social Media page reloads from here.
export async function GET() {
  const { admin, deny } = await requireRole(MARKETING_READ_ROLES);
  if (deny) return deny;
  try {
    return NextResponse.json(await loadSocialData(admin));
  } catch (e) {
    if (e instanceof PrWorkspaceNotReady) return NextResponse.json({ error: 'Social media tracking is not set up yet (migration 127).' }, { status: 503 });
    return NextResponse.json({ error: 'Could not load social media data' }, { status: 500 });
  }
}
