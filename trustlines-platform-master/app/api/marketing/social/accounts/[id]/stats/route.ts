import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { parseFollowerStat } from '@/lib/marketing/prWorkspace';
import { dbError } from '@/lib/marketing/prWorkspaceServer';

type Params = { params: Promise<{ id: string }> };

// Records the follower count for a day. Entering the same day again corrects that day's number.
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  const parsed = parseFollowerStat(await req.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.value.recorded_on > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: 'The date can’t be in the future' }, { status: 400 });
  }

  const { data: account, error: readError } = await admin.from('social_accounts')
    .select('id').eq('id', id).is('deleted_at', null).maybeSingle();
  if (readError) return dbError('save the follower count', readError);
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const { data, error } = await admin.from('social_account_stats')
    .upsert({ account_id: id, ...parsed.value, created_by: user.id }, { onConflict: 'account_id,recorded_on' })
    .select('id, account_id, recorded_on, followers').single();
  if (error) return dbError('save the follower count', error);

  await logAudit({ actorId: user.id, action: 'social_account.followers_recorded', resource: `social_account:${id}`, newValue: parsed.value });
  return NextResponse.json({ stat: data }, { status: 201 });
}
