import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions/requireApi';
import { logAudit } from '@/lib/audit/log';
import { APPROVAL_LINK_ROLES } from '@/lib/approvals/reviewToken';

type Params = { params: Promise<{ id: string; linkId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id, linkId } = await params;
  const { user, admin, deny } = await requireRole(APPROVAL_LINK_ROLES);
  if (deny) return deny;

  const body = await req.json().catch(() => ({})) as { action?: string };
  if (body.action !== 'revoke') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  const { data, error } = await admin.from('approval_links')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', linkId).eq('project_id', id).neq('status', 'completed')
    .select('id, status').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Link not found (or already completed)' }, { status: 404 });

  await admin.from('approval_link_events').insert({ approval_link_id: linkId, event_type: 'revoked' });
  await logAudit({ actorId: user.id, action: 'approval_link.revoked', projectId: id, resource: `approval_link:${linkId}` });
  return NextResponse.json({ ok: true });
}
