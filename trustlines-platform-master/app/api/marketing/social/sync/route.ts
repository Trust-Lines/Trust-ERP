import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { syncAccounts } from '@/lib/social/service';

export const maxDuration = 300;

// "Sync now": refresh followers and post results from the platforms (all connected accounts,
// or one with { accountId }). Reads only — nothing is posted.
export async function POST(req: NextRequest) {
  const { admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;
  const body = await req.json().catch(() => ({})) as { accountId?: string };
  try {
    const results = await syncAccounts(admin, body.accountId || undefined);
    return NextResponse.json({ results });
  } catch (e) {
    console.error('[social sync]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Could not sync the accounts' }, { status: 500 });
  }
}
