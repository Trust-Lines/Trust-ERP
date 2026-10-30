import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { requireTlinesDashboard } from '@/lib/keyClients/access';
import { cleanAliases } from '@/lib/keyClients/match';

type Params = { params: Promise<{ id: string }> };
const COLS = 'id, name, aliases, notes, is_active';

// { name?, aliases?, notes?, is_active? } — edit a key client. is_active=false takes it off the
// dashboard without losing its links.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, canManage, deny } = await requireTlinesDashboard();
  if (deny) return deny;
  if (!canManage) return NextResponse.json({ error: 'Only managers can change the key client list' }, { status: 403 });
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('name' in b) {
    const n = String(b.name ?? '').trim().slice(0, 120);
    if (!n) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    patch.name = n;
  }
  if ('aliases' in b) patch.aliases = cleanAliases(b.aliases);
  if ('notes' in b) patch.notes = String(b.notes ?? '').trim().slice(0, 1000) || null;
  if ('is_active' in b) patch.is_active = b.is_active !== false;
  const { data, error } = await admin.from('key_clients').update(patch).eq('id', id).is('deleted_at', null).select(COLS).maybeSingle();
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Another client already has that name' : error.message }, { status: error.code === '23505' ? 409 : 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await logAudit({ actorId: user.id, action: 'key_client.updated', resource: `key_client:${id}`, newValue: patch });
  return NextResponse.json({ client: data });
}

// Soft delete — the client leaves the list; nothing on its Opportunities changes.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { user, admin, canManage, deny } = await requireTlinesDashboard();
  if (deny) return deny;
  if (!canManage) return NextResponse.json({ error: 'Only managers can change the key client list' }, { status: 403 });
  const { data, error } = await admin.from('key_clients').update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id).is('deleted_at', null).select('name').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await logAudit({ actorId: user.id, action: 'key_client.removed', resource: `key_client:${id}`, oldValue: { name: data.name } });
  return NextResponse.json({ ok: true });
}
