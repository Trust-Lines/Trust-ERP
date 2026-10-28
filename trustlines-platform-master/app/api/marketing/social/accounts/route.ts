import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { parseSocialAccount, SOCIAL_ACCOUNT_COLS } from '@/lib/marketing/prWorkspace';
import { dbError } from '@/lib/marketing/prWorkspaceServer';

export async function POST(req: NextRequest) {
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  const parsed = parseSocialAccount(await req.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await admin.from('social_accounts')
    .insert({ ...parsed.value, created_by: user.id }).select(SOCIAL_ACCOUNT_COLS).single();
  if (error) return dbError('add the account', error);

  await logAudit({ actorId: user.id, action: 'social_account.created', resource: `social_account:${data.id}`, newValue: { platform: data.platform, handle: data.handle } });
  return NextResponse.json({ account: data }, { status: 201 });
}
