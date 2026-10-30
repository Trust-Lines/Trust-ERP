import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit/log';
import { requireTlinesDashboard } from '@/lib/keyClients/access';
import { KEY_CLIENTS_NOT_READY, keyClientsMissing, loadKeyClients } from '@/lib/keyClients/server';
import { cleanAliases } from '@/lib/keyClients/match';

// The key client list (TLines dashboard → Clients Opportunity), with every manual link.
export async function GET() {
  const { admin, canManage, deny } = await requireTlinesDashboard();
  if (deny) return deny;
  try {
    const data = await loadKeyClients(admin, { includeInactive: true });
    return NextResponse.json({ ...data, canManage });
  } catch (e) {
    if (keyClientsMissing(e)) return NextResponse.json({ notReady: KEY_CLIENTS_NOT_READY, clients: [], links: [], canManage });
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load key clients' }, { status: 500 });
  }
}

// { name, aliases?, notes? } — add a client to the list.
export async function POST(req: NextRequest) {
  const { user, admin, canManage, deny } = await requireTlinesDashboard();
  if (deny) return deny;
  if (!canManage) return NextResponse.json({ error: 'Only managers can change the key client list' }, { status: 403 });
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const name = String(b.name ?? '').trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: 'Name the client' }, { status: 400 });
  const { data, error } = await admin.from('key_clients').insert({
    name, aliases: cleanAliases(b.aliases), notes: String(b.notes ?? '').trim().slice(0, 1000) || null, created_by: user.id,
  }).select('id, name, aliases, notes, is_active').single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: `"${name}" is already on the list` }, { status: 409 });
    return NextResponse.json({ error: keyClientsMissing(error) ? KEY_CLIENTS_NOT_READY : error.message }, { status: keyClientsMissing(error) ? 409 : 500 });
  }
  await logAudit({ actorId: user.id, action: 'key_client.created', resource: `key_client:${data.id}`, newValue: { name } });
  return NextResponse.json({ client: data }, { status: 201 });
}
