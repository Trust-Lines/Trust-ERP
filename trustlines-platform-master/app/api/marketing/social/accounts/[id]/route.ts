import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_WRITE_ROLES } from '@/lib/marketing/roles';
import { parseSocialAccount, SOCIAL_ACCOUNT_COLS } from '@/lib/marketing/prWorkspace';
import { canDelete, dbError } from '@/lib/marketing/prWorkspaceServer';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  const parsed = parseSocialAccount(await req.json().catch(() => null), true);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (Object.keys(parsed.value).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await admin.from('social_accounts').update(parsed.value)
    .eq('id', id).is('deleted_at', null).select(SOCIAL_ACCOUNT_COLS).maybeSingle();
  if (error) return dbError('save the account', error);
  if (!data) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  await logAudit({ actorId: user.id, action: 'social_account.updated', resource: `social_account:${id}`, newValue: parsed.value });
  return NextResponse.json({ account: data });
}

// Soft delete: the account disappears from the page, its posts and follower history stay.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, role, admin, deny } = await requireRole(MARKETING_WRITE_ROLES);
  if (deny) return deny;

  const { data: row, error: readError } = await admin.from('social_accounts')
    .select('id, created_by').eq('id', id).is('deleted_at', null).maybeSingle();
  if (readError) return dbError('remove the account', readError);
  if (!row) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  if (!canDelete(role, user.id, row.created_by)) {
    return NextResponse.json({ error: 'Only the person who added this account or a Marketing manager can remove it' }, { status: 403 });
  }

  const { error } = await admin.from('social_accounts').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return dbError('remove the account', error);

  await logAudit({ actorId: user.id, action: 'social_account.deleted', resource: `social_account:${id}` });
  return NextResponse.json({ ok: true });
}
