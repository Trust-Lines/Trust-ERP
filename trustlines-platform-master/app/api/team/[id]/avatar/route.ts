import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveRequestUser, isOpsRole } from '@/lib/permissions/requestUser';
import { logAudit } from '@/lib/audit/log';
import { removeAvatar, saveAvatar } from '@/lib/profile/avatar';

// Team → a member's profile photo, set by an admin (the same ops roles that edit members,
// app/api/team/[id]). Same storage as Settings' own photo (lib/profile/avatar).

type Params = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

async function guard(req: NextRequest, id: string) {
  const caller = await resolveRequestUser(req);
  if (!caller) return { deny: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isOpsRole(caller.role)) return { deny: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  if (!UUID.test(id)) return { deny: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data } = await admin.from('profiles').select('id').eq('id', id).maybeSingle();
  if (!data) return { deny: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  return { admin, callerId: caller.userId };
}

// multipart: file
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const g = await guard(req, id);
  if ('deny' in g) return g.deny;
  const form = await req.formData().catch(() => null);
  const r = await saveAvatar(g.admin, id, form?.get('file'));
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  await logAudit({ actorId: g.callerId, action: 'team.photo_updated', resource: `profile:${id}` });
  return NextResponse.json(r);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const g = await guard(req, id);
  if ('deny' in g) return g.deny;
  const failed = await removeAvatar(g.admin, id);
  if (failed) return NextResponse.json(failed, { status: 500 });
  await logAudit({ actorId: g.callerId, action: 'team.photo_removed', resource: `profile:${id}` });
  return NextResponse.json({ ok: true });
}
