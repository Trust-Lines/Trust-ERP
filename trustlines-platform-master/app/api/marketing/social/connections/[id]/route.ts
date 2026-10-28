import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { MARKETING_MANAGE_ROLES } from '@/lib/marketing/roles';
import { dbError } from '@/lib/marketing/prWorkspaceServer';

type Params = { params: Promise<{ id: string }> };

// Disconnect: the stored tokens are wiped (the ERP can no longer read or post), the accounts
// stay with their history and become manual. Reconnecting later picks them up again.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, deny } = await requireRole(MARKETING_MANAGE_ROLES, 'Only a Marketing manager can disconnect accounts');
  if (deny) return deny;

  const { data: conn, error: readError } = await admin.from('social_connections')
    .select('id, provider').eq('id', id).is('revoked_at', null).maybeSingle();
  if (readError) return dbError('disconnect', readError);
  if (!conn) return NextResponse.json({ error: 'Connection not found' }, { status: 404 });

  const { error: accError } = await admin.from('social_accounts')
    .update({ connection_id: null, external_token_enc: null }).eq('connection_id', id);
  if (accError) return dbError('disconnect', accError);
  const { error } = await admin.from('social_connections')
    .update({ revoked_at: new Date().toISOString(), access_token_enc: '', refresh_token_enc: null }).eq('id', id);
  if (error) return dbError('disconnect', error);

  await logAudit({ actorId: user.id, action: 'social_connection.revoked', resource: `social_connection:${id}`, newValue: { provider: conn.provider } });
  return NextResponse.json({ ok: true });
}
